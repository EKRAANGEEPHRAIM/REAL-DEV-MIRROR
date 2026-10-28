import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthTokenType, Prisma, type User } from '../../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { UsersService } from '../users/users.service.js';
import {
  AuthService,
  INVALID_CREDENTIALS_MESSAGE,
  SAME_PASSWORD,
  WRONG_CURRENT_PASSWORD,
} from './auth.service.js';
import { OneTimeTokenService } from './one-time-token.service.js';
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
  const users = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn(),
    updatePassword: vi.fn(),
  };
  const oneTimeTokens = { create: vi.fn(), consume: vi.fn() };
  const mail = { send: vi.fn() };
  const config = { get: vi.fn(() => 'https://app.devmirror.dev/') };
  const passwords = { hash: vi.fn(), verify: vi.fn() };
  const tokens = {
    accessTokenTtlSeconds: 900,
    signAccessToken: vi.fn(),
    createRefreshToken: vi.fn(),
    consumeRefreshToken: vi.fn(),
    revoke: vi.fn(),
    revokeAll: vi.fn(),
    revokeAllExcept: vi.fn(),
  };
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokens.signAccessToken.mockResolvedValue('jwt-acces');
    tokens.createRefreshToken.mockResolvedValue(refreshToken);
    oneTimeTokens.create.mockResolvedValue('lien-secret');
    mail.send.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: OneTimeTokenService, useValue: oneTimeTokens },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'Ancien2026', newPassword: 'Nouveau2026' };

    it('vérifie l’actuel, enregistre le nouveau et ferme les autres sessions', async () => {
      users.findById.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      passwords.hash.mockResolvedValue('nouveau-hash');

      await service.changePassword('user-1', dto, 'jeton-en-cours');

      expect(passwords.verify).toHaveBeenCalledWith('Ancien2026', 'hash-secret');
      expect(users.updatePassword).toHaveBeenCalledWith('user-1', 'nouveau-hash');
      expect(tokens.revokeAllExcept).toHaveBeenCalledWith('user-1', 'jeton-en-cours');
      expect(tokens.revokeAll).not.toHaveBeenCalled();
    });

    it('refuse un mot de passe actuel incorrect (400, pas 401) sans rien changer', async () => {
      users.findById.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      await expect(service.changePassword('user-1', dto, undefined)).rejects.toMatchObject({
        status: 400,
        message: WRONG_CURRENT_PASSWORD,
      });
      expect(users.updatePassword).not.toHaveBeenCalled();
      expect(tokens.revokeAllExcept).not.toHaveBeenCalled();
    });

    it('refuse un nouveau mot de passe identique à l’actuel', async () => {
      users.findById.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(
        service.changePassword(
          'user-1',
          { currentPassword: 'Meme2026', newPassword: 'Meme2026' },
          undefined,
        ),
      ).rejects.toMatchObject({ status: 400, message: SAME_PASSWORD });
    });
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
          bio: null,
          links: { github: null, linkedin: null, website: null },
          preferences: { theme: 'system', language: 'fr' },
          emailVerified: false,
          createdAt: user.createdAt,
        },
      });
    });

    it('envoie l’email de vérification avec un lien vers le front', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hash-secret');
      users.create.mockResolvedValue(user);

      await service.register(dto);

      expect(oneTimeTokens.create).toHaveBeenCalledWith('user-1', AuthTokenType.EMAIL_VERIFY);
      expect(mail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ada@devmirror.dev',
          text: expect.stringContaining(
            'https://app.devmirror.dev/verify-email?token=lien-secret',
          ) as string,
        }),
      );
    });

    it('ouvre la session même si l’envoi de l’email échoue', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hash-secret');
      users.create.mockResolvedValue(user);
      mail.send.mockRejectedValue(new Error('Resend indisponible'));

      await expect(service.register(dto)).resolves.toMatchObject({ accessToken: 'jwt-acces' });
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

  describe('vérification de l’email', () => {
    it('verifyEmail consomme le lien et marque l’adresse vérifiée', async () => {
      oneTimeTokens.consume.mockResolvedValue('user-1');

      await service.verifyEmail('jeton');

      expect(oneTimeTokens.consume).toHaveBeenCalledWith('jeton', AuthTokenType.EMAIL_VERIFY);
      expect(users.markEmailVerified).toHaveBeenCalledWith('user-1');
    });

    it('resendVerification n’envoie rien si l’adresse est déjà vérifiée', async () => {
      users.findById.mockResolvedValue({ ...user, emailVerified: true });

      await service.resendVerification('user-1');

      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('mot de passe oublié', () => {
    it('forgotPassword ne fait rien pour un email inconnu', async () => {
      users.findByEmail.mockResolvedValue(null);

      await service.forgotPassword('inconnu@devmirror.dev');

      expect(oneTimeTokens.create).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('forgotPassword envoie un lien de réinitialisation à un compte existant', async () => {
      users.findByEmail.mockResolvedValue(user);

      await service.forgotPassword(user.email);
      await vi.waitFor(() => expect(mail.send).toHaveBeenCalled());

      expect(oneTimeTokens.create).toHaveBeenCalledWith('user-1', AuthTokenType.PASSWORD_RESET);
      expect(mail.send.mock.calls[0][0].text).toContain(
        'https://app.devmirror.dev/reset-password?token=lien-secret',
      );
    });

    it('resetPassword enregistre le nouveau hash et ferme toutes les sessions', async () => {
      oneTimeTokens.consume.mockResolvedValue('user-1');
      passwords.hash.mockResolvedValue('nouveau-hash');

      await service.resetPassword('jeton', 'NouveauMotDePasse2026');

      expect(oneTimeTokens.consume).toHaveBeenCalledWith('jeton', AuthTokenType.PASSWORD_RESET);
      expect(users.updatePassword).toHaveBeenCalledWith('user-1', 'nouveau-hash');
      expect(tokens.revokeAll).toHaveBeenCalledWith('user-1');
    });
  });

  it('logout révoque le refresh token présent, et ne fait rien sans cookie', async () => {
    await service.logout('jeton');
    await service.logout(undefined);

    expect(tokens.revoke).toHaveBeenCalledTimes(1);
    expect(tokens.revoke).toHaveBeenCalledWith('jeton');
  });
});
