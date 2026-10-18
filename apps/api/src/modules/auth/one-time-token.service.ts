import { BadRequestException, Injectable } from '@nestjs/common';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/crypto/opaque-token.js';
import { AuthTokenType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const INVALID_LINK_MESSAGE = 'Lien invalide ou expiré';

/** Durée de validité des liens envoyés par email (cahier des charges : 1 heure). */
export const ONE_TIME_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Liens à usage unique envoyés par email (vérification d'adresse, mot de passe oublié). */
@Injectable()
export class OneTimeTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un lien et invalide les précédents du même type : un seul lien actif à la fois. */
  async create(userId: string, type: AuthTokenType): Promise<string> {
    const now = new Date();
    await this.prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: now },
    });

    const token = generateOpaqueToken();
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(now.getTime() + ONE_TIME_TOKEN_TTL_MS),
      },
    });
    return token;
  }

  /** Consomme le lien (une seule fois) et renvoie l'id de son propriétaire. */
  async consume(token: string, type: AuthTokenType): Promise<string> {
    const stored = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });
    if (!stored || stored.type !== type || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_LINK_MESSAGE);
    }

    const { count } = await this.prisma.authToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new BadRequestException(INVALID_LINK_MESSAGE);

    return stored.userId;
  }
}
