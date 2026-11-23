import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ProjectRole } from '../../../generated/prisma/client.js';
import { ACCESS_ROLES, type AccessRole } from '../../projects/project-access.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Personne de l'équipe d'un projet, propriétaire compris. */
export class MemberResponseDto {
  @ApiProperty({ example: 'clx0usr000002' })
  userId: string;

  @ApiProperty({ example: 'Grace Hopper' })
  name: string;

  @ApiProperty({ example: 'grace@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl: string | null;

  @ApiProperty({ enum: ACCESS_ROLES, enumName: 'AccessRole', example: ProjectRole.EDITOR })
  role: AccessRole;

  @ApiProperty({ example: '2026-11-23T09:00:00.000Z', description: 'Arrivée dans le projet' })
  joinedAt: Date;
}

export class InviterDto {
  @ApiProperty({ example: 'clx0usr000001' })
  id: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;
}

/** Invitation en attente, vue par le propriétaire du projet. */
export class InvitationResponseDto {
  @ApiProperty({ example: 'clx0inv000001' })
  id: string;

  @ApiProperty({ example: 'grace@example.com' })
  email: string;

  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole', example: ProjectRole.EDITOR })
  role: ProjectRole;

  @ApiProperty({ type: InviterDto })
  invitedBy: InviterDto;

  @ApiProperty({ example: '2026-11-30T09:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2026-11-23T09:00:00.000Z' })
  createdAt: Date;
}

export class InvitedProjectDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

/** Invitation reçue, vue par la personne invitée. */
export class ReceivedInvitationDto {
  @ApiProperty({ example: 'clx0inv000001' })
  id: string;

  @ApiProperty({ type: InvitedProjectDto })
  project: InvitedProjectDto;

  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole', example: ProjectRole.EDITOR })
  role: ProjectRole;

  @ApiProperty({ type: InviterDto })
  invitedBy: InviterDto;

  @ApiProperty({ example: '2026-11-30T09:00:00.000Z' })
  expiresAt: Date;
}

export class AcceptedInvitationDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e', description: 'Projet rejoint' })
  projectId: string;
}

export class CreateInvitationDto {
  @ApiProperty({ example: 'grace@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({
    enum: ProjectRole,
    enumName: 'ProjectRole',
    default: ProjectRole.EDITOR,
    description: 'EDITOR : modifie le projet et ses tâches ; VIEWER : lecture seule',
  })
  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;
}

export class UpdateMemberDto {
  @ApiProperty({ enum: ProjectRole, enumName: 'ProjectRole', example: ProjectRole.VIEWER })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
