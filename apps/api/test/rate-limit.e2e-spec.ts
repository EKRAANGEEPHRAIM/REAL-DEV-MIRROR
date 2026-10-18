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
});
