import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const user: User = {
  id: 'user-1',
  email: 'ada@devmirror.dev',
  passwordHash: 'hash-secret',
  name: 'Ada Lovelace',
  avatarUrl: null,
  bio: null,
  links: {},
  preferences: {},
  emailVerified: false,
  createdAt: new Date('2026-10-17T09:00:00Z'),
  updatedAt: new Date('2026-10-17T09:00:00Z'),
};

const refreshToken = { token: 'refresh-opaque', expiresAt: new Date('2026-10-25T09:00:00Z') };

describe('AuthService', () => {
  const users = { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() };
  const passwords = { hash: vi.fn(), verify: vi.fn() };
  const tokens = {
    accessTokenTtlSeconds: 900,
    signAccessToken: vi.fn(),
    createRefreshToken: vi.fn(),
    consumeRefreshToken: vi.fn(),
    revoke: vi.fn(),
    revokeAll: vi.fn(),
  };
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokens.signAccessToken.mockResolvedValue('jwt-acces');
    tokens.createRefreshToken.mockResolvedValue(refreshToken);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = { name: 'Ada Lovelace', email: 'ada@devmirror.dev', password: 'MotDePasse2026' };

    it('hache le mot de passe et ouvre une session sans exposer le hash', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hash-secret');
      users.create.mockResolvedValue(user);

      const session = await service.register(dto);

      expect(passwords.hash).toHaveBeenCalledWith('MotDePasse2026');
      expect(users.create).toHaveBeenCalledWith({
        email: dto.email,
        name: dto.name,
        passwordHash: 'hash-secret',
      });
      expect(tokens.signAccessToken).toHaveBeenCalledWith({ id: 'user-1', email: user.email });
      expect(tokens.createRefreshToken).toHaveBeenCalledWith('user-1');
      expect(session).toEqual({
        accessToken: 'jwt-acces',
        expiresIn: 900,
        refreshToken,
        user: {
          id: 'user-1',
          email: 'ada@devmirror.dev',
          name: 'Ada Lovelace',
          avatarUrl: null,
          emailVerified: false,
          createdAt: user.createdAt,
        },
      });
    });

    it('refuse un email déjà inscrit (409)', async () => {
      users.findByEmail.mockResolvedValue(user);

      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('transforme la violation de contrainte unique (P2002) en 409', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hash-secret');
      users.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    const dto = { email: 'ada@devmirror.dev', password: 'MotDePasse2026' };

    it('ouvre une session quand le mot de passe est correct', async () => {
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(dto)).resolves.toMatchObject({
        accessToken: 'jwt-acces',
        user: { id: 'user-1' },
      });
      expect(passwords.verify).toHaveBeenCalledWith('MotDePasse2026', 'hash-secret');
    });

    it('refuse un mauvais mot de passe (401) sans émettre de jeton', async () => {
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
      expect(tokens.createRefreshToken).not.toHaveBeenCalled();
    });

    it('refuse un email inconnu avec le même message, après une vérification factice', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
      expect(passwords.verify).toHaveBeenCalledWith('MotDePasse2026', undefined);
    });
  });

  describe('refresh', () => {
    it('consomme le refresh token et ouvre une nouvelle session', async () => {
      tokens.consumeRefreshToken.mockResolvedValue('user-1');
      users.findById.mockResolvedValue(user);

      await expect(service.refresh('ancien')).resolves.toMatchObject({ refreshToken });
      expect(tokens.consumeRefreshToken).toHaveBeenCalledWith('ancien');
    });

    it('refuse une requête sans cookie (401)', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.consumeRefreshToken).not.toHaveBeenCalled();
    });

    it('refuse si le compte a été supprimé (401)', async () => {
      tokens.consumeRefreshToken.mockResolvedValue('user-1');
      users.findById.mockResolvedValue(null);

      await expect(service.refresh('ancien')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('logout révoque le refresh token présent, et ne fait rien sans cookie', async () => {
    await service.logout('jeton');
    await service.logout(undefined);

    expect(tokens.revoke).toHaveBeenCalledTimes(1);
    expect(tokens.revoke).toHaveBeenCalledWith('jeton');
  });
});
