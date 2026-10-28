import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation.js';
import { AuthTokenType, Prisma, type User } from '../../generated/prisma/client.js';
import { type MailMessage, MailService } from '../mail/mail.service.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import { passwordResetEmail, verificationEmail } from './auth-mails.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { OneTimeTokenService } from './one-time-token.service.js';
import { PasswordService } from './password.service.js';
import { INVALID_REFRESH_MESSAGE, type IssuedRefreshToken, TokenService } from './token.service.js';

export const EMAIL_TAKEN_MESSAGE = 'Un compte existe déjà avec cet email';
export const INVALID_CREDENTIALS_MESSAGE = 'Email ou mot de passe incorrect';
export const WRONG_CURRENT_PASSWORD = 'Le mot de passe actuel est incorrect';
export const SAME_PASSWORD = 'Le nouveau mot de passe doit être différent de l’actuel';

/** Session ouverte : le contrôleur renvoie le jeton d'accès et pose le refresh token en cookie. */
export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: IssuedRefreshToken;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appUrl: string;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly oneTimeTokens: OneTimeTokenService,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
  }

  async register(dto: RegisterDto): Promise<AuthSession> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException(EMAIL_TAKEN_MESSAGE);
    }

    const passwordHash = await this.passwords.hash(dto.password);
    let user: User;
    try {
      user = await this.users.create({ email: dto.email, name: dto.name, passwordHash });
    } catch (error) {
      // Deux inscriptions simultanées : la contrainte unique tranche.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      throw error;
    }

    // Un échec d'envoi ne doit pas annuler l'inscription : le lien peut être renvoyé.
    await this.sendVerificationEmail(user);
    return this.openSession(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.oneTimeTokens.consume(token, AuthTokenType.EMAIL_VERIFY);
    await this.users.markEmailVerified(userId);
  }

  /** Renvoie le lien de vérification ; sans effet si l'adresse est déjà vérifiée. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (user && !user.emailVerified) await this.sendVerificationEmail(user);
  }

  /**
   * Toujours la même réponse, que l'email soit inscrit ou non (pas d'énumération des comptes).
   * L'envoi n'est pas attendu, pour que le temps de réponse ne trahisse rien non plus.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = await this.oneTimeTokens.create(user.id, AuthTokenType.PASSWORD_RESET);
    void this.sendSafely(
      passwordResetEmail(user, `${this.appUrl}/reset-password?token=${token}`),
      user.id,
    );
  }

  /** Change le mot de passe et ferme toutes les sessions ouvertes (appareils perdus, vol). */
  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.oneTimeTokens.consume(token, AuthTokenType.PASSWORD_RESET);
    await this.users.updatePassword(userId, await this.passwords.hash(password));
    await this.tokens.revokeAll(userId);
  }

  /**
   * Change le mot de passe d'un utilisateur connecté et ferme ses autres sessions ; celle en
   * cours (son refresh token) reste ouverte. 400 et non 401 sur un mauvais mot de passe : le
   * front traite un 401 comme une session expirée.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException(WRONG_CURRENT_PASSWORD);
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(SAME_PASSWORD);
    }
    await this.users.updatePassword(userId, await this.passwords.hash(dto.newPassword));
    await this.tokens.revokeAllExcept(userId, currentRefreshToken);
  }

  /** Vérifie les identifiants ; le même message couvre l'email inconnu et le mauvais mot de passe. */
  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await this.passwords.verify(dto.password, user?.passwordHash);

    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    return this.openSession(user);
  }

  /** Échange un refresh token contre une nouvelle session (rotation). */
  async refresh(refreshToken: string | undefined): Promise<AuthSession> {
    if (!refreshToken) throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);

    const userId = await this.tokens.consumeRefreshToken(refreshToken);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);

    return this.openSession(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
  }

  logoutAll(userId: string): Promise<void> {
    return this.tokens.revokeAll(userId);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = await this.oneTimeTokens.create(user.id, AuthTokenType.EMAIL_VERIFY);
    await this.sendSafely(
      verificationEmail(user, `${this.appUrl}/verify-email?token=${token}`),
      user.id,
    );
  }

  private async sendSafely(message: MailMessage, userId: string): Promise<void> {
    try {
      await this.mail.send(message);
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email « ${message.subject} » (utilisateur ${userId})`,
        error,
      );
    }
  }

  private async openSession(user: User): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken({ id: user.id, email: user.email }),
      this.tokens.createRefreshToken(user.id),
    ]);
    return {
      accessToken,
      expiresIn: this.tokens.accessTokenTtlSeconds,
      refreshToken,
      user: UserResponseDto.fromUser(user),
    };
  }
}
