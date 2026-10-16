import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service.js';
import { PasswordService } from './password.service.js';

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

describe('AuthService', () => {
  const users = { findByEmail: vi.fn(), create: vi.fn() };
  const passwords = { hash: vi.fn(), verify: vi.fn() };
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = { name: 'Ada Lovelace', email: 'ada@devmirror.dev', password: 'MotDePasse2026' };

    it('hache le mot de passe et renvoie le compte sans le hash', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hash-secret');
      users.create.mockResolvedValue(user);

      const result = await service.register(dto);

      expect(passwords.hash).toHaveBeenCalledWith('MotDePasse2026');
      expect(users.create).toHaveBeenCalledWith({
        email: dto.email,
        name: dto.name,
        passwordHash: 'hash-secret',
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'ada@devmirror.dev',
        name: 'Ada Lovelace',
        avatarUrl: null,
        emailVerified: false,
        createdAt: user.createdAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
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

    it('renvoie le compte quand le mot de passe est correct', async () => {
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(dto)).resolves.toMatchObject({ id: 'user-1' });
      expect(passwords.verify).toHaveBeenCalledWith('MotDePasse2026', 'hash-secret');
    });

    it('refuse un mauvais mot de passe (401)', async () => {
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
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
});
