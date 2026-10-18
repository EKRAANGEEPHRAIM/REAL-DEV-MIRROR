import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Comptes créés sur la base de dev/test, supprimés en fin de suite.
const EMAIL_DOMAIN = '@e2e.devmirror.test';
const email = `auth-${Date.now()}${EMAIL_DOMAIN}`;
const password = 'MotDePasse2026';

/** Extrait le cookie dm_refresh (valeur + attributs) d'une réponse. */
function refreshCookie(response: request.Response): { header: string; raw: string } {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const raw = cookies.find((cookie) => cookie.startsWith('dm_refresh=')) ?? '';
  return { header: raw.split(';')[0], raw };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  describe('inscription et connexion', () => {
    it('POST /auth/register crée le compte, renvoie un jeton et pose le cookie httpOnly (201)', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({ name: 'Ada E2E', email: email.toUpperCase(), password })
        .expect(201);

      expect(response.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { email, name: 'Ada E2E', emailVerified: false },
      });
      expect(response.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('refreshToken');

      const { raw } = refreshCookie(response);
      expect(raw).toMatch(/HttpOnly/i);
      expect(raw).toMatch(/SameSite=Strict/i);
      expect(raw).toMatch(/Path=\/api\/v1\/auth/);

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored?.passwordHash).toMatch(/^\$2b\$12\$/);
    });

    it('POST /auth/register refuse un email déjà inscrit (409)', () => {
      return request(server)
        .post('/api/v1/auth/register')
        .send({ name: 'Ada bis', email, password })
        .expect(409);
    });

    it('POST /auth/register refuse des données invalides et les champs inconnus (400)', async () => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({ name: 'A', email: 'pas-un-email', password: 'court', role: 'ADMIN' })
        .expect(400);

      const messages = (response.body.message as string[]).join(' | ');
      expect(messages).toContain('Adresse email invalide');
      expect(messages).toContain('role should not exist');
    });

    it('POST /auth/login renvoie le même 401 pour un mauvais mot de passe et un email inconnu', async () => {
      const wrongPassword = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: 'MauvaisMotDePasse1' })
        .expect(401);
      const unknownEmail = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: `inconnu${EMAIL_DOMAIN}`, password })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Email ou mot de passe incorrect');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('routes protégées', () => {
    it('GET /users/me exige un jeton d’accès (401)', () => {
      return request(server).get('/api/v1/users/me').expect(401);
    });

    it('GET /users/me renvoie le profil avec un jeton valide (200)', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      const me = await request(server)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(me.body).toMatchObject({ email, name: 'Ada E2E' });
    });

    it('GET /health reste public', () => {
      return request(server).get('/api/v1/health').expect(200);
    });
  });

  describe('refresh token', () => {
    it('POST /auth/refresh fait tourner le jeton ; réutiliser l’ancien révoque toutes les sessions', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const first = refreshCookie(login).header;

      // 1. Rotation : nouveau jeton d'accès et nouveau cookie
      const rotated = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = refreshCookie(rotated).header;
      expect(rotated.body.accessToken).toEqual(expect.any(String));
      expect(second).not.toBe(first);

      // 2. Rejouer l'ancien cookie = vol présumé : 401 et cookie effacé
      const replay = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', first)
        .expect(401);
      expect(refreshCookie(replay).raw).toMatch(/dm_refresh=;/);

      // 3. Le jeton légitime le plus récent est révoqué lui aussi
      await request(server).post('/api/v1/auth/refresh').set('Cookie', second).expect(401);
    });

    it('POST /auth/refresh sans cookie renvoie 401', () => {
      return request(server).post('/api/v1/auth/refresh').expect(401);
    });

    it('POST /auth/logout révoque la session courante (204)', async () => {
      const login = await request(server).post('/api/v1/auth/login').send({ email, password });
      const cookie = refreshCookie(login).header;

      const logout = await request(server)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      expect(refreshCookie(logout).raw).toMatch(/dm_refresh=;/);

      await request(server).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('POST /auth/logout-all révoque toutes les sessions de l’utilisateur (204)', async () => {
      const phone = await request(server).post('/api/v1/auth/login').send({ email, password });
      const laptop = await request(server).post('/api/v1/auth/login').send({ email, password });

      await request(server)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${laptop.body.accessToken}`)
        .expect(204);

      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie(phone).header)
        .expect(401);
      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie(laptop).header)
        .expect(401);
    });
  });
});
