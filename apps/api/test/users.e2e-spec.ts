import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { AvatarStorage } from './../src/modules/users/avatar-storage.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@users.e2e.devmirror.test';
const stamp = Date.now();
const PASSWORD = 'MotDePasse2026';

/** Faux stockage : rien n'est envoyé à Cloudinary pendant les tests. */
const storage = {
  enabled: true,
  upload: vi.fn(
    async (userId: string) => `https://res.cloudinary.test/v1/devmirror/avatars/${userId}.webp`,
  ),
  remove: vi.fn(async () => undefined),
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Profil, avatar et mot de passe (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `ada-${stamp}${EMAIL_DOMAIN}`;
  let token: string;
  let cookie: string;

  const authed = () => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`).send(body),
    post: (url: string) =>
      request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`),
  });

  /** Cookie dm_refresh d'une réponse de connexion. */
  const refreshCookie = (headers: Record<string, unknown>): string =>
    ([] as string[])
      .concat((headers['set-cookie'] as string[] | string | undefined) ?? [])
      .find((c) => c.startsWith('dm_refresh='))!
      .split(';')[0];

  const login = async (password = PASSWORD) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    return response;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async () => undefined })
      .overrideProvider(AvatarStorage)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ada Lovelace', email, password: PASSWORD })
      .expect(201);
    token = response.body.accessToken as string;
    cookie = refreshCookie(response.headers);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('renvoie le profil avec liens et préférences par défaut', async () => {
    const { body } = await authed().get('/api/v1/users/me').expect(200);
    expect(body).toMatchObject({
      name: 'Ada Lovelace',
      bio: null,
      avatarUrl: null,
      links: { github: null, linkedin: null, website: null },
      preferences: { theme: 'system', language: 'fr' },
    });
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('modifie le profil ; liens et préférences sont fusionnés', async () => {
    await authed()
      .patch('/api/v1/users/me', {
        name: '  Ada King  ',
        bio: 'Développeuse Angular et NestJS.',
        links: { github: 'https://github.com/ada', website: 'https://ada.dev' },
        preferences: { theme: 'dark' },
      })
      .expect(200);

    const { body } = await authed()
      .patch('/api/v1/users/me', { links: { website: null }, preferences: { language: 'en' } })
      .expect(200);
    expect(body).toMatchObject({
      name: 'Ada King',
      bio: 'Développeuse Angular et NestJS.',
      links: { github: 'https://github.com/ada', linkedin: null, website: null },
      preferences: { theme: 'dark', language: 'en' },
    });

    const invalid = await authed()
      .patch('/api/v1/users/me', { links: { github: 'https://evil.example/ada' } })
      .expect(400);
    expect(invalid.body.message).toEqual([expect.stringContaining('github.com')]);
    await authed().patch('/api/v1/users/me', { email: 'pirate@x.test' }).expect(400);
  });

  it('envoie l’avatar : image vérifiée, 2 Mo au plus', async () => {
    const { body } = await authed()
      .post('/api/v1/users/me/avatar')
      .attach('avatar', PNG, { filename: 'moi.png', contentType: 'image/png' })
      .expect(201);
    expect(body.avatarUrl).toMatch(/^https:\/\/res\.cloudinary\.test\/.+\.webp$/);
    expect(storage.upload).toHaveBeenCalledWith(body.id, expect.any(Buffer));

    // Faux PNG : le contenu compte, pas le nom ni le type annoncé
    const fake = await authed()
      .post('/api/v1/users/me/avatar')
      .attach('avatar', Buffer.from('<svg/>'), { filename: 'moi.png', contentType: 'image/png' })
      .expect(400);
    expect(fake.body.message).toContain('Format d’image non pris en charge');

    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const tooLarge = await authed()
      .post('/api/v1/users/me/avatar')
      .attach('avatar', big, { filename: 'grand.png', contentType: 'image/png' })
      .expect(413);
    expect(tooLarge.body.message).toBe('L’image dépasse 2 Mo');

    await authed().post('/api/v1/users/me/avatar').expect(400);
  });

  it('retire l’avatar', async () => {
    await authed().delete('/api/v1/users/me/avatar').expect(204);
    expect(storage.remove).toHaveBeenCalled();
    expect((await authed().get('/api/v1/users/me')).body.avatarUrl).toBeNull();
  });

  it('change le mot de passe : garde la session en cours, ferme les autres', async () => {
    const other = refreshCookie((await login()).headers);
    const change = (body: object) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookie)
        .send(body);

    const wrong = await change({ currentPassword: 'Mauvais2026', newPassword: 'Nouveau2026' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe('Le mot de passe actuel est incorrect');
    await change({ currentPassword: PASSWORD, newPassword: 'court' }).expect(400);

    await change({ currentPassword: PASSWORD, newPassword: 'Nouveau2026' }).expect(204);

    // L'autre appareil est déconnecté, celui-ci non
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', other)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect((await login()).status).toBe(401);
    expect((await login('Nouveau2026')).status).toBe(200);
  });
});
