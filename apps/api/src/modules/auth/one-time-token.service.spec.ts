import { BadRequestException } from '@nestjs/common';
import { hashOpaqueToken } from '../../common/crypto/opaque-token.js';
import { AuthTokenType } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ONE_TIME_TOKEN_TTL_MS, OneTimeTokenService } from './one-time-token.service.js';

describe('OneTimeTokenService', () => {
  const prisma = { authToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() } };
  const service = new OneTimeTokenService(prisma as unknown as PrismaService);

  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'at-1',
    userId: 'user-1',
    type: AuthTokenType.PASSWORD_RESET,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    ...overrides,
  });

  beforeEach(() => vi.clearAllMocks());

  it('invalide les liens précédents du même type puis crée un lien d’une heure', async () => {
    const token = await service.create('user-1', AuthTokenType.EMAIL_VERIFY);

    expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', type: AuthTokenType.EMAIL_VERIFY, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const { data } = prisma.authToken.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(hashOpaqueToken(token));
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(ONE_TIME_TOKEN_TTL_MS - 5_000);
  });

  it('consomme un lien valide une seule fois', async () => {
    prisma.authToken.findUnique.mockResolvedValue(stored());
    prisma.authToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.consume('jeton', AuthTokenType.PASSWORD_RESET)).resolves.toBe('user-1');
  });

  it.each([
    ['inconnu', null],
    ['déjà utilisé', stored({ usedAt: new Date() })],
    ['expiré', stored({ expiresAt: new Date(Date.now() - 1000) })],
    ['d’un autre type', stored({ type: AuthTokenType.EMAIL_VERIFY })],
  ])('refuse un lien %s (400)', async (_cas, record) => {
    prisma.authToken.findUnique.mockResolvedValue(record);

    await expect(service.consume('jeton', AuthTokenType.PASSWORD_RESET)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse quand une requête concurrente a déjà consommé le lien', async () => {
    prisma.authToken.findUnique.mockResolvedValue(stored());
    prisma.authToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.consume('jeton', AuthTokenType.PASSWORD_RESET)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
