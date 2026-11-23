import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/crypto/opaque-token.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { Prisma, ProjectRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import type {
  AcceptedInvitationDto,
  CreateInvitationDto,
  InvitationResponseDto,
  MemberResponseDto,
  ReceivedInvitationDto,
  UpdateMemberDto,
} from './dto/member.dto.js';
import { invitationEmail } from './invitation-mail.js';

/** Une invitation reste valable une semaine. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Garde-fous contre l'envoi d'emails en masse depuis un projet. */
export const MAX_PENDING_INVITATIONS = 20;
export const MAX_MEMBERS = 50;

export const MEMBER_NOT_FOUND = 'Membre introuvable';
export const INVITATION_NOT_FOUND = 'Invitation introuvable ou expirée';
export const ALREADY_MEMBER = 'Cette personne fait déjà partie du projet';
export const NOT_YOUR_INVITATION = 'Cette invitation a été envoyée à une autre adresse email';
export const VERIFY_EMAIL_FIRST =
  'Confirmez votre adresse email pour accepter une invitation, ou ouvrez le lien reçu par email';
export const OWNER_CANNOT_LEAVE = 'Le propriétaire ne peut pas quitter son propre projet';

const inviterSelect = { select: { id: true, name: true } } as const;

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Équipe d'un projet : membres, rôles et invitations par email.
 * Le propriétaire gère l'équipe ; un membre peut seulement quitter le projet.
 */
@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
  }

  /** Équipe du projet, propriétaire en tête ; visible par tous ses membres. */
  async listMembers(userId: string, projectId: string): Promise<MemberResponseDto[]> {
    await this.projects.roleFor(userId, projectId);

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        createdAt: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    const owner: MemberResponseDto = {
      userId: project.user.id,
      name: project.user.name,
      email: project.user.email,
      avatarUrl: project.user.avatarUrl,
      role: 'OWNER',
      joinedAt: project.createdAt,
    };
    return [
      owner,
      ...project.members.map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.createdAt,
      })),
    ];
  }

  async updateMember(
    userId: string,
    projectId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    await this.projects.assertOwner(userId, projectId);
    try {
      const member = await this.prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId: memberId } },
        data: { role: dto.role },
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      return {
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.createdAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(MEMBER_NOT_FOUND);
      }
      throw error;
    }
  }

  /** Le propriétaire retire un membre ; un membre peut se retirer lui-même (quitter). */
  async removeMember(userId: string, projectId: string, memberId: string): Promise<void> {
    const role = await this.projects.roleFor(userId, projectId);
    if (memberId === userId) {
      if (role === 'OWNER') throw new BadRequestException(OWNER_CANNOT_LEAVE);
    } else if (role !== 'OWNER') {
      await this.projects.assertOwner(userId, projectId);
    }

    const { count } = await this.prisma.projectMember.deleteMany({
      where: { projectId, userId: memberId },
    });
    if (count === 0) throw new NotFoundException(MEMBER_NOT_FOUND);
  }

  /** Invitations en attente du projet (non acceptées, non expirées). */
  async listInvitations(userId: string, projectId: string): Promise<InvitationResponseDto[]> {
    await this.projects.assertOwner(userId, projectId);
    return this.prisma.projectInvitation.findMany({
      where: { projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: inviterSelect,
      },
    });
  }

  /**
   * Invite une adresse email. Réinviter la même adresse remplace l'invitation précédente
   * (nouveau lien, nouveau rôle) au lieu d'en empiler plusieurs.
   */
  async invite(
    user: AuthUser,
    projectId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    await this.projects.assertOwner(user.id, projectId);
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? ProjectRole.EDITOR;

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        name: true,
        user: { select: { email: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    if (sameEmail(project.user.email, email)) throw new ConflictException(ALREADY_MEMBER);
    if (project._count.members >= MAX_MEMBERS) {
      throw new BadRequestException(`${MAX_MEMBERS} membres au maximum par projet`);
    }
    const alreadyMember = await this.prisma.projectMember.count({
      where: { projectId, user: { email } },
    });
    if (alreadyMember > 0) throw new ConflictException(ALREADY_MEMBER);

    const now = new Date();
    const pending = await this.prisma.projectInvitation.count({
      where: { projectId, acceptedAt: null, expiresAt: { gt: now }, NOT: { email } },
    });
    if (pending >= MAX_PENDING_INVITATIONS) {
      throw new BadRequestException(
        `${MAX_PENDING_INVITATIONS} invitations en attente au maximum par projet`,
      );
    }

    const token = generateOpaqueToken();
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.projectInvitation.deleteMany({ where: { projectId, email, acceptedAt: null } });
      return tx.projectInvitation.create({
        data: {
          projectId,
          email,
          role,
          tokenHash: hashOpaqueToken(token),
          invitedById: user.id,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: inviterSelect,
        },
      });
    });

    try {
      await this.mail.send(
        invitationEmail({
          to: email,
          inviterName: project.user.name,
          projectName: project.name,
          role,
          link: `${this.appUrl}/invitations/${token}`,
        }),
      );
    } catch (error) {
      // L'invitation reste valable : l'invité la verra dans l'application en se connectant.
      this.logger.error(`Échec d'envoi de l'invitation ${invitation.id}`, error);
    }
    return invitation;
  }

  async revokeInvitation(userId: string, projectId: string, invitationId: string): Promise<void> {
    await this.projects.assertOwner(userId, projectId);
    const { count } = await this.prisma.projectInvitation.deleteMany({
      where: { id: invitationId, projectId, acceptedAt: null },
    });
    if (count === 0) throw new NotFoundException(INVITATION_NOT_FOUND);
  }

  /** Invitations en attente adressées à l'utilisateur connecté. */
  async receivedInvitations(user: AuthUser): Promise<ReceivedInvitationDto[]> {
    return this.prisma.projectInvitation.findMany({
      where: {
        email: user.email.trim().toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        project: { select: { id: true, name: true, color: true } },
        invitedBy: inviterSelect,
      },
    });
  }

  /** Aperçu d'une invitation ouverte depuis le lien reçu par email. */
  async previewByToken(user: AuthUser, token: string): Promise<ReceivedInvitationDto> {
    const invitation = await this.findPendingByToken(token);
    if (!sameEmail(invitation.email, user.email)) throw new ForbiddenException(NOT_YOUR_INVITATION);
    return {
      id: invitation.id,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      project: {
        id: invitation.project.id,
        name: invitation.project.name,
        color: invitation.project.color,
      },
      invitedBy: invitation.invitedBy,
    };
  }

  /** Le lien reçu par email prouve la possession de l'adresse : pas besoin qu'elle soit vérifiée. */
  async acceptByToken(user: AuthUser, token: string): Promise<AcceptedInvitationDto> {
    const invitation = await this.findPendingByToken(token);
    if (!sameEmail(invitation.email, user.email)) throw new ForbiddenException(NOT_YOUR_INVITATION);
    return this.join(user.id, invitation);
  }

  /**
   * Acceptation depuis l'application (sans le lien) : l'adresse du compte doit être vérifiée,
   * sinon n'importe qui pourrait créer un compte avec l'email d'un autre et prendre sa place.
   */
  async acceptById(user: AuthUser, invitationId: string): Promise<AcceptedInvitationDto> {
    const invitation = await this.findPendingForUser(user, invitationId);
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { emailVerified: true },
    });
    if (!account.emailVerified) throw new ForbiddenException(VERIFY_EMAIL_FIRST);
    return this.join(user.id, invitation);
  }

  async decline(user: AuthUser, invitationId: string): Promise<void> {
    const invitation = await this.findPendingForUser(user, invitationId);
    await this.prisma.projectInvitation.delete({ where: { id: invitation.id } });
  }

  private async findPendingByToken(token: string) {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      select: pendingSelect,
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
      throw new NotFoundException(INVITATION_NOT_FOUND);
    }
    return invitation;
  }

  private async findPendingForUser(user: AuthUser, invitationId: string) {
    const invitation = await this.prisma.projectInvitation.findFirst({
      where: {
        id: invitationId,
        email: user.email.trim().toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: pendingSelect,
    });
    if (!invitation) throw new NotFoundException(INVITATION_NOT_FOUND);
    return invitation;
  }

  /** Ajoute le membre et consomme l'invitation, ensemble ; une invitation ne sert qu'une fois. */
  private async join(
    userId: string,
    invitation: { id: string; role: ProjectRole; project: { id: string; userId: string } },
  ): Promise<AcceptedInvitationDto> {
    const projectId = invitation.project.id;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.projectInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (count === 0) throw new NotFoundException(INVITATION_NOT_FOUND);

      // Le propriétaire n'est jamais membre ; un membre existant garde sa ligne (rôle mis à jour).
      if (invitation.project.userId !== userId) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role: invitation.role },
          update: { role: invitation.role },
        });
        await tx.activity.create({
          data: { userId, type: 'PROJECT_JOINED', entityType: 'PROJECT', entityId: projectId },
        });
      }
    });
    return { projectId };
  }
}

const pendingSelect = {
  id: true,
  email: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  project: { select: { id: true, name: true, color: true, userId: true } },
  invitedBy: inviterSelect,
} satisfies Prisma.ProjectInvitationSelect;
