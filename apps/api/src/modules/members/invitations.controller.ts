import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { AcceptedInvitationDto, ReceivedInvitationDto } from './dto/member.dto.js';
import { MembersService } from './members.service.js';

/** Invitations reçues par l'utilisateur connecté (par son adresse email). */
@ApiTags('invitations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Mes invitations en attente' })
  @ApiOkResponse({ type: [ReceivedInvitationDto] })
  received(@CurrentUser() user: AuthUser): Promise<ReceivedInvitationDto[]> {
    return this.members.receivedInvitations(user);
  }

  @Get('token/:token')
  @ApiOperation({ summary: 'Aperçu d’une invitation ouverte depuis le lien de l’email' })
  @ApiOkResponse({ type: ReceivedInvitationDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invitation introuvable ou expirée' })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Invitation destinée à une autre adresse',
  })
  preview(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<ReceivedInvitationDto> {
    return this.members.previewByToken(user, token);
  }

  @Post('token/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter depuis le lien de l’email' })
  @ApiOkResponse({ type: AcceptedInvitationDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invitation introuvable ou expirée' })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Invitation destinée à une autre adresse',
  })
  acceptByToken(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<AcceptedInvitationDto> {
    return this.members.acceptByToken(user, token);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter depuis l’application (adresse email vérifiée requise)' })
  @ApiOkResponse({ type: AcceptedInvitationDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invitation introuvable ou expirée' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Adresse email non vérifiée' })
  acceptById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<AcceptedInvitationDto> {
    return this.members.acceptById(user, id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Refuser une invitation' })
  @ApiNoContentResponse({ description: 'Invitation refusée' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invitation introuvable ou expirée' })
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.members.decline(user, id);
  }
}
