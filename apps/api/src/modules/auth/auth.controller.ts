import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation.js';
import { AuthService, type AuthSession } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Créer un compte et ouvrir une session' })
  @ApiCreatedResponse({ type: AuthResponseDto, description: 'Pose aussi le cookie dm_refresh' })
  @ApiBadRequestResponse({ description: 'Données invalides (nom, email ou mot de passe)' })
  @ApiConflictResponse({ description: 'Un compte existe déjà avec cet email' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(await this.auth.register(dto), res);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter' })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Pose aussi le cookie dm_refresh' })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiUnauthorizedResponse({ description: 'Email ou mot de passe incorrect' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(await this.auth.login(dto), res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Renouveler la session à partir du cookie dm_refresh (rotation)' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Cookie absent, expiré, révoqué ou réutilisé' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    try {
      return this.respond(await this.auth.refresh(readRefreshCookie(req)), res);
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Fermer la session courante' })
  @ApiNoContentResponse()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    this.clearCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fermer toutes les sessions de l’utilisateur' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Jeton d’accès manquant ou invalide' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    this.clearCookie(res);
  }

  private respond(session: AuthSession, res: Response): AuthResponseDto {
    res.cookie(
      REFRESH_COOKIE,
      session.refreshToken.token,
      refreshCookieOptions(this.secureCookies, session.refreshToken.expiresAt),
    );
    return {
      accessToken: session.accessToken,
      tokenType: 'Bearer',
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }

  private clearCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.secureCookies));
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
