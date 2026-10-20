import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp, setupSwagger } from './../src/app.setup.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  it('GET /api/v1/health renvoie ok et une base Neon joignable', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('ajoute les en-têtes de sécurité Helmet', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('autorise le front local en CORS', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:4200');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('expose le document OpenAPI sur /api/docs-json', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.info.title).toBe('DevMirror API');
    expect(response.body.paths).toHaveProperty('/api/v1/health');
  });

  it('renvoie 404 hors du préfixe /api/v1', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  it('formate toutes les erreurs de la même façon (route inconnue)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/inexistant').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /api/v1/inexistant',
      error: 'Not Found',
      path: '/api/v1/inexistant',
      timestamp: expect.any(String),
    });
  });

  it('expose les modèles communs (erreurs, pagination) dans l’OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.components.schemas).toHaveProperty('ErrorResponseDto');
    expect(response.body.components.schemas).toHaveProperty('PaginationMetaDto');
  });

  afterEach(async () => {
    await app.close();
  });
});
