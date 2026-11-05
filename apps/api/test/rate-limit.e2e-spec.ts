import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

describe('Limitation de débit (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Réactivée pour ce fichier uniquement (setup-e2e.ts la désactive) ; AppModule est importé
    // après coup car ConfigModule lit l'environnement au chargement du module.
    process.env.RATE_LIMIT_ENABLED = 'true';
    // Comme en production : l'IP vient de X-Forwarded-For (que le client peut falsifier).
    process.env.TRUST_PROXY = 'true';
    const { AppModule } = await import('./../src/app.module.js');
    const { configureApp } = await import('./../src/app.setup.js');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login renvoie 429 à la 6e tentative en moins d’une minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'personne@e2e.devmirror.test', password: 'MotDePasse2026' });

    for (let i = 0; i < 5; i++) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);

    expect(blocked.body.message).toBe('Trop de tentatives, réessayez dans une minute');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  /** Attaquant qui annonce une IP différente à chaque requête : la limite par IP ne voit rien. */
  const spoofed = (i: number) => `198.51.100.${i}`;

  it('limite par compte : 10 essais par email, même avec une IP falsifiée à chaque requête', async () => {
    const attempt = (i: number) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', spoofed(i))
        .send({ email: 'Cible@e2e.devmirror.test', password: `Essai${i}2026x` });

    for (let i = 0; i < 10; i++) {
      await attempt(i).expect(401);
    }
    const blocked = await attempt(10).expect(429);

    expect(blocked.body.message).toBe('Trop de tentatives pour ce compte, réessayez plus tard');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Autre compte, même attaquant : pas bloqué.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', spoofed(11))
      .send({ email: 'autre@e2e.devmirror.test', password: 'Essai2026x' })
      .expect(401);
  });

  it('compte de démo (mot de passe public, partagé) : pas de limite par compte', async () => {
    for (let i = 0; i < 12; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', spoofed(100 + i))
        .send({ email: 'demo@devmirror.dev', password: `Mauvais${i}2026` })
        .expect(401);
    }
  });

  it('mot de passe oublié : 3 emails par compte et par heure, quelle que soit l’IP', async () => {
    const ask = (i: number) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', spoofed(200 + i))
        .send({ email: 'victime@e2e.devmirror.test' });

    for (let i = 0; i < 3; i++) {
      await ask(i).expect(202);
    }
    await ask(3).expect(429);
  });
});
