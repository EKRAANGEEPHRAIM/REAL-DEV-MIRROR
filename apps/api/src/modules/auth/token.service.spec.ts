import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashRefreshToken, TokenService } from './token.service.js';

describe('TokenService', () => {
  const prisma = {
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  };
  const config = {
    get: vi.fn(
      (key: string) => ({ ACCESS_TOKEN_TTL_SECONDS: 900, REFRESH_TOKEN_TTL_DAYS: 7 })[key],
    ),
  };
  const jwt = new JwtService({ secret: 'secret-de-test-assez-long-0123456789abcdef' });
  let service: TokenService;

  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: hashRefreshToken('jeton'),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(TokenService);
  });

  it('signe un jeton d’accès contenant sub et email', async () => {
    const token = await service.signAccessToken({ id: 'user-1', email: 'ada@devmirror.dev' });

    await expect(jwt.verifyAsync(token)).resolves.toMatchObject({
      sub: 'user-1',
      email: 'ada@devmirror.dev',
    });
  });

  it('crée un refresh token aléatoire de 7 jours et ne stocke que son hash', async () => {
    const issued = await service.createRefreshToken('user-1');

    expect(issued.token).toMatch(/^[\w-]{43}$/);
    const { data } = prisma.refreshToken.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(hashRefreshToken(issued.token));
    expect(data.tokenHash).not.toBe(issued.token);
    const days = (issued.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeCloseTo(7, 1);
  });

  describe('consumeRefreshToken', () => {
    it('consomme un jeton valide et renvoie son propriétaire', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.consumeRefreshToken('jeton')).resolves.toBe('user-1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('refuse un jeton inconnu ou expiré', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.consumeRefreshToken('jeton')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        stored({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.consumeRefreshToken('jeton')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('révoque toutes les sessions si un jeton déjà consommé est réutilisé', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored({ revokedAt: new Date() }));

      await expect(service.consumeRefreshToken('jeton')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('refuse sans révocation globale quand une requête concurrente a déjà consommé le jeton', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.consumeRefreshToken('jeton')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
