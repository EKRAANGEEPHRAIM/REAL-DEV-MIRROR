import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { hashOpaqueToken } from '../../common/crypto/opaque-token.js';
import { ProjectRole } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import {
  ALREADY_MEMBER,
  INVITATION_NOT_FOUND,
  MAX_PENDING_INVITATIONS,
  MembersService,
  NOT_YOUR_INVITATION,
  OWNER_CANNOT_LEAVE,
  VERIFY_EMAIL_FIRST,
} from './members.service.js';

const owner = { id: 'owner-1', email: 'ada@example.com' };
const grace = { id: 'user-2', email: 'grace@example.com' };
const future = () => new Date(Date.now() + 60_000);

const pendingInvitation = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  email: 'grace@example.com',
  role: ProjectRole.EDITOR,
  expiresAt: future(),
  acceptedAt: null,
  project: { id: 'p1', name: 'DevMirror', color: null, userId: owner.id },
  invitedBy: { id: owner.id, name: 'Ada' },
  ...overrides,
});

describe('MembersService', () => {
  const tx = {
    projectInvitation: { deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    projectMember: { upsert: vi.fn() },
    activity: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((work: (t: typeof tx) => unknown) => work(tx)),
    project: { findUniqueOrThrow: vi.fn() },
    projectMember: { count: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    projectInvitation: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUniqueOrThrow: vi.fn() },
  };
  const projects = { roleFor: vi.fn(), assertOwner: vi.fn() };
  const mail = { send: vi.fn() };
  const config = { get: vi.fn(() => 'https://devmirror.app/') };
  const service = new MembersService(
    prisma as unknown as PrismaService,
    projects as unknown as ProjectsService,
    mail as unknown as MailService,
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((work: (t: typeof tx) => unknown) => work(tx));
  });

  describe('invite', () => {
    beforeEach(() => {
      prisma.project.findUniqueOrThrow.mockResolvedValue({
        name: 'DevMirror',
        user: { email: owner.email, name: 'Ada' },
        _count: { members: 1 },
      });
      prisma.projectMember.count.mockResolvedValue(0);
      prisma.projectInvitation.count.mockResolvedValue(0);
      tx.projectInvitation.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inv-1', ...data }),
      );
    });

    it('réservé au propriétaire : rien n’est créé ni envoyé sinon', async () => {
      projects.assertOwner.mockRejectedValueOnce(new ForbiddenException());

      await expect(service.invite(grace, 'p1', { email: 'x@example.com' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.projectInvitation.create).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('stocke l’empreinte du jeton, jamais le jeton, et envoie le lien par email', async () => {
      await service.invite(owner, 'p1', { email: ' Grace@Example.com ', role: ProjectRole.VIEWER });

      const { data } = tx.projectInvitation.create.mock.calls[0][0];
      expect(data).toMatchObject({
        projectId: 'p1',
        email: 'grace@example.com',
        role: ProjectRole.VIEWER,
        invitedById: owner.id,
      });
      const message = mail.send.mock.calls[0][0];
      const token = /invitations\/([\w-]+)/.exec(message.text)![1];
      expect(data.tokenHash).toBe(hashOpaqueToken(token));
      expect(data.tokenHash).not.toBe(token);
      expect(message.to).toBe('grace@example.com');
      expect(message.text).toContain('https://devmirror.app/invitations/');
    });

    it('réinviter la même adresse remplace l’invitation précédente', async () => {
      await service.invite(owner, 'p1', { email: 'grace@example.com' });

      expect(tx.projectInvitation.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', email: 'grace@example.com', acceptedAt: null },
      });
    });

    it('refuse le propriétaire lui-même et les membres existants (409)', async () => {
      await expect(service.invite(owner, 'p1', { email: owner.email })).rejects.toThrow(
        new ConflictException(ALREADY_MEMBER),
      );

      prisma.projectMember.count.mockResolvedValue(1);
      await expect(service.invite(owner, 'p1', { email: grace.email })).rejects.toThrow(
        new ConflictException(ALREADY_MEMBER),
      );
      expect(tx.projectInvitation.create).not.toHaveBeenCalled();
    });

    it(`limite les invitations en attente à ${MAX_PENDING_INVITATIONS} par projet`, async () => {
      prisma.projectInvitation.count.mockResolvedValue(MAX_PENDING_INVITATIONS);

      await expect(service.invite(owner, 'p1', { email: grace.email })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('un échec d’envoi d’email ne fait pas échouer l’invitation (visible dans l’app)', async () => {
      mail.send.mockRejectedValueOnce(new Error('Resend indisponible'));

      await expect(service.invite(owner, 'p1', { email: grace.email })).resolves.toMatchObject({
        id: 'inv-1',
      });
    });
  });

  describe('accepter une invitation', () => {
    it('par le lien : ajoute le membre et consomme l’invitation dans la même transaction', async () => {
      prisma.projectInvitation.findUnique.mockResolvedValue(pendingInvitation());
      tx.projectInvitation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.acceptByToken(grace, 'jeton')).resolves.toEqual({ projectId: 'p1' });

      expect(prisma.projectInvitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashOpaqueToken('jeton') } }),
      );
      expect(tx.projectMember.upsert).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: 'p1', userId: grace.id } },
        create: { projectId: 'p1', userId: grace.id, role: ProjectRole.EDITOR },
        update: { role: ProjectRole.EDITOR },
      });
    });

    it('un lien transféré à un autre compte ne sert à rien (403)', async () => {
      prisma.projectInvitation.findUnique.mockResolvedValue(pendingInvitation());

      await expect(
        service.acceptByToken({ id: 'u9', email: 'intrus@example.com' }, 'jeton'),
      ).rejects.toThrow(new ForbiddenException(NOT_YOUR_INVITATION));
      expect(tx.projectMember.upsert).not.toHaveBeenCalled();
    });

    it('lien expiré, déjà utilisé ou inconnu : 404', async () => {
      prisma.projectInvitation.findUnique.mockResolvedValueOnce(
        pendingInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.acceptByToken(grace, 'jeton')).rejects.toThrow(
        new NotFoundException(INVITATION_NOT_FOUND),
      );

      prisma.projectInvitation.findUnique.mockResolvedValueOnce(
        pendingInvitation({ acceptedAt: new Date() }),
      );
      await expect(service.acceptByToken(grace, 'jeton')).rejects.toBeInstanceOf(NotFoundException);

      prisma.projectInvitation.findUnique.mockResolvedValueOnce(null);
      await expect(service.acceptByToken(grace, 'jeton')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deux acceptations simultanées : la seconde échoue (usage unique)', async () => {
      prisma.projectInvitation.findUnique.mockResolvedValue(pendingInvitation());
      tx.projectInvitation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptByToken(grace, 'jeton')).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.projectMember.upsert).not.toHaveBeenCalled();
    });

    it('depuis l’application : l’adresse email du compte doit être vérifiée', async () => {
      prisma.projectInvitation.findFirst.mockResolvedValue(pendingInvitation());
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ emailVerified: false });

      await expect(service.acceptById(grace, 'inv-1')).rejects.toThrow(
        new ForbiddenException(VERIFY_EMAIL_FIRST),
      );

      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ emailVerified: true });
      tx.projectInvitation.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.acceptById(grace, 'inv-1')).resolves.toEqual({ projectId: 'p1' });
      // L'invitation est cherchée par l'adresse du compte : impossible d'accepter celle d'un autre
      expect(prisma.projectInvitation.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 'inv-1',
        email: 'grace@example.com',
        acceptedAt: null,
      });
    });

    it('le propriétaire qui ouvre sa propre invitation ne devient pas membre', async () => {
      prisma.projectInvitation.findUnique.mockResolvedValue(
        pendingInvitation({ email: owner.email }),
      );
      tx.projectInvitation.updateMany.mockResolvedValue({ count: 1 });

      await service.acceptByToken(owner, 'jeton');
      expect(tx.projectMember.upsert).not.toHaveBeenCalled();
    });
  });

  describe('équipe', () => {
    it('le propriétaire ne peut pas quitter son projet', async () => {
      projects.roleFor.mockResolvedValue('OWNER');

      await expect(service.removeMember(owner.id, 'p1', owner.id)).rejects.toThrow(
        new BadRequestException(OWNER_CANNOT_LEAVE),
      );
    });

    it('un membre peut quitter le projet, mais pas retirer un coéquipier', async () => {
      projects.roleFor.mockResolvedValue(ProjectRole.EDITOR);
      prisma.projectMember.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeMember(grace.id, 'p1', grace.id);
      expect(prisma.projectMember.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', userId: grace.id },
      });

      projects.assertOwner.mockRejectedValueOnce(new ForbiddenException());
      await expect(service.removeMember(grace.id, 'p1', 'user-3')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.projectMember.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('la liste de l’équipe met le propriétaire en tête', async () => {
      projects.roleFor.mockResolvedValue(ProjectRole.VIEWER);
      prisma.project.findUniqueOrThrow.mockResolvedValue({
        createdAt: new Date('2026-01-01'),
        user: { id: owner.id, name: 'Ada', email: owner.email, avatarUrl: null },
        members: [
          {
            role: ProjectRole.VIEWER,
            createdAt: new Date('2026-02-01'),
            user: { id: grace.id, name: 'Grace', email: grace.email, avatarUrl: null },
          },
        ],
      });

      const team = await service.listMembers(grace.id, 'p1');
      expect(team.map((member) => [member.userId, member.role])).toEqual([
        [owner.id, 'OWNER'],
        [grace.id, ProjectRole.VIEWER],
      ]);
    });
  });
});
