import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthUser } from '../../common/auth/auth-user.js';
import { EnvironmentVariables } from '../../config/env.validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const INVALID_REFRESH_MESSAGE = 'Session expirée, reconnectez-vous';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Refresh tokens opaques (32 octets aléatoires). Seul leur SHA-256 est stocké : une fuite
 * de la base ne permet pas de rejouer une session. SHA-256 suffit ici (pas bcrypt) car
 * le jeton a 256 bits d'entropie, contrairement à un mot de passe.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  signAccessToken(user: AuthUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  async createRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashRefreshToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /**
   * Rotation : consomme le refresh token (usage unique) et renvoie l'id de son propriétaire.
   * Un jeton déjà consommé qui revient signale un vol probable : toutes les sessions
   * de l'utilisateur sont révoquées.
   */
  async consumeRefreshToken(token: string): Promise<string> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });
    if (!stored || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }
    if (stored.revokedAt) {
      await this.revokeAll(stored.userId);
      throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);
    }

    // updateMany conditionnel : si deux requêtes utilisent le même jeton en même temps,
    // une seule le consomme ; l'autre reçoit un 401 sans déclencher la révocation globale.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException(INVALID_REFRESH_MESSAGE);

    return stored.userId;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
