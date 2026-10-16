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

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('POST /auth/register crée le compte (201) sans exposer le hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ada E2E', email: email.toUpperCase(), password })
      .expect(201);

    expect(response.body).toMatchObject({ email, name: 'Ada E2E', emailVerified: false });
    expect(response.body).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.passwordHash).toMatch(/^\$2b\$12\$/);
  });

  it('POST /auth/register refuse un email déjà inscrit (409)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ada bis', email, password })
      .expect(409);
  });

  it('POST /auth/register refuse des données invalides et les champs inconnus (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'pas-un-email', password: 'court', role: 'ADMIN' })
      .expect(400);

    const messages = (response.body.message as string[]).join(' | ');
    expect(messages).toContain('Adresse email invalide');
    expect(messages).toContain('role should not exist');
  });

  it('POST /auth/login connecte avec les bons identifiants (200)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body).toMatchObject({ email });
  });

  it('POST /auth/login renvoie le même 401 pour un mauvais mot de passe et un email inconnu', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'MauvaisMotDePasse1' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `inconnu${EMAIL_DOMAIN}`, password })
      .expect(401);

    expect(wrongPassword.body.message).toBe('Email ou mot de passe incorrect');
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });
});
