import { Body, Controller, Delete, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation.js';
import { AuthService } from './auth.service.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie.js';

/**
 * Suppression du compte, sous /users/me comme le reste du compte, mais dans le module auth :
 * elle a besoin de la vérification du mot de passe et efface le cookie de session.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class AccountController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  @Delete('me')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Supprimer définitivement son compte et toutes ses données (confirmation par mot de passe)',
  })
  @ApiNoContentResponse({ description: 'Compte supprimé ; cookie de session effacé' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Mot de passe incorrect' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Jeton d’accès manquant ou invalide',
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives, réessayez dans une minute' })
  async delete(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user.id, dto.password);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.secureCookies));
  }
}
