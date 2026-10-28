import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthUser } from '../../common/auth/auth-user.js';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/crypto/opaque-token.js';
import { EnvironmentVariables } from '../../config/env.validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const INVALID_REFRESH_MESSAGE = 'Session expirée, reconnectez-vous';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** Refresh tokens opaques ; seule leur empreinte SHA-256 est stockée. */
export const hashRefreshToken = hashOpaqueToken;

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
    const token = generateOpaqueToken();
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

  /**
   * Ferme toutes les sessions sauf celle de ce refresh token (l'appareil en cours). Les autres
   * jetons sont supprimés, pas marqués révoqués : un appareil déconnecté qui retente sa chance
   * avec son ancien jeton doit recevoir un simple 401, pas déclencher la détection de vol
   * (qui fermerait aussi la session qu'on vient de garder).
   */
  async revokeAllExcept(userId: string, keptToken: string | undefined): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        revokedAt: null,
        ...(keptToken && { tokenHash: { not: hashRefreshToken(keptToken) } }),
      },
    });
  }
}
