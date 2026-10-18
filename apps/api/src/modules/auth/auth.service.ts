import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';
import { INVALID_REFRESH_MESSAGE, type IssuedRefreshToken, TokenService } from './token.service.js';

export const EMAIL_TAKEN_MESSAGE = 'Un compte existe déjà avec cet email';
export const INVALID_CREDENTIALS_MESSAGE = 'Email ou mot de passe incorrect';

/** Session ouverte : le contrôleur renvoie le jeton d'accès et pose le refresh token en cookie. */
export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: IssuedRefreshToken;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

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
    return this.openSession(user);
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
