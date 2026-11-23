import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { DemoRestricted } from '../../common/demo/demo-account.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dto/member.dto.js';
import { MembersService } from './members.service.js';

/** Chaque invitation envoie un email : limite serrée par IP. */
const INVITE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('members')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Projet introuvable' })
@Controller('projects/:projectId')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  @ApiOperation({ summary: 'Équipe du projet, propriétaire en tête' })
  @ApiOkResponse({ type: [MemberResponseDto] })
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ): Promise<MemberResponseDto[]> {
    return this.members.listMembers(user.id, projectId);
  }

  @Patch('members/:userId')
  @ApiOperation({ summary: 'Changer le rôle d’un membre (propriétaire seulement)' })
  @ApiOkResponse({ type: MemberResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Rôle invalide' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Réservé au propriétaire' })
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('userId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    return this.members.updateMember(user.id, projectId, memberId, dto);
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Retirer un membre (propriétaire), ou quitter le projet (son propre id)',
  })
  @ApiNoContentResponse({ description: 'Membre retiré' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Le propriétaire ne peut pas partir',
  })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Réservé au propriétaire' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('userId') memberId: string,
  ): Promise<void> {
    return this.members.removeMember(user.id, projectId, memberId);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Invitations en attente (propriétaire seulement)' })
  @ApiOkResponse({ type: [InvitationResponseDto] })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Réservé au propriétaire' })
  listInvitations(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ): Promise<InvitationResponseDto[]> {
    return this.members.listInvitations(user.id, projectId);
  }

  @Post('invitations')
  @Throttle(INVITE_LIMIT)
  // Les identifiants de démo sont publics : pas d'envoi d'emails à des inconnus depuis ce compte.
  @DemoRestricted()
  @ApiOperation({
    summary: 'Inviter une personne par email (propriétaire seulement)',
    description: 'Réinviter la même adresse remplace l’invitation précédente.',
  })
  @ApiCreatedResponse({ type: InvitationResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Email invalide ou limite atteinte',
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Déjà membre du projet' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.members.invite(user, projectId, dto);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler une invitation (propriétaire seulement)' })
  @ApiNoContentResponse({ description: 'Invitation annulée' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Réservé au propriétaire' })
  revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    return this.members.revokeInvitation(user.id, projectId, invitationId);
  }
}
