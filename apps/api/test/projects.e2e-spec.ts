import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@projects.e2e.devmirror.test';
const stamp = Date.now();

describe('Projets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;

  async function signUp(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email: `projects-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  const api = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object) =>
      request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async () => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    ada = await signUp('ada');
    grace = await signUp('grace');
  });

  afterAll(async () => {
    // La cascade supprime projets, tâches et activités des comptes de test.
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('exige un jeton d’accès (401)', () => {
    return request(app.getHttpServer()).get('/api/v1/projects').expect(401);
  });

  it('crée, lit, modifie et supprime un projet', async () => {
    const created = await api(ada)
      .post('/api/v1/projects', {
        name: '  DevMirror ',
        description: 'Portfolio SaaS',
        status: 'IN_PROGRESS',
        techStack: ['Angular', 'angular', 'NestJS'],
        repoUrl: 'https://github.com/ada/devmirror',
        color: '#6366f1',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'DevMirror',
      status: 'IN_PROGRESS',
      techStack: ['Angular', 'NestJS'],
      tags: [],
      progress: { total: 0, done: 0, percent: 0 },
    });
    const id = created.body.id as string;

    await api(ada).get(`/api/v1/projects/${id}`).expect(200);

    const updated = await api(ada)
      .patch(`/api/v1/projects/${id}`, { status: 'DONE', description: null })
      .expect(200);
    expect(updated.body).toMatchObject({ status: 'DONE', description: null, name: 'DevMirror' });

    await api(ada).delete(`/api/v1/projects/${id}`).expect(204);
    await api(ada).get(`/api/v1/projects/${id}`).expect(404);
  });

  it('isole les projets : un autre utilisateur reçoit 404 en lecture, modification et suppression', async () => {
    const { body } = await api(ada).post('/api/v1/projects', { name: 'Secret' }).expect(201);
    const url = `/api/v1/projects/${body.id as string}`;

    const read = await api(grace).get(url).expect(404);
    expect(read.body.message).toBe('Projet introuvable');
    await api(grace).patch(url, { name: 'Volé' }).expect(404);
    await api(grace).delete(url).expect(404);

    const list = await api(grace).get('/api/v1/projects').expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).not.toContain(body.id);

    // Toujours intact pour sa propriétaire
    const still = await api(ada).get(url).expect(200);
    expect(still.body.name).toBe('Secret');
  });

  it('liste avec recherche, filtre de statut, archivés masqués, tri et pagination', async () => {
    for (const [name, status] of [
      ['Alpha API', 'IDEA'],
      ['Beta front', 'IN_PROGRESS'],
      ['Gamma archive', 'ARCHIVED'],
    ]) {
      await api(grace).post('/api/v1/projects', { name, status }).expect(201);
    }

    const all = await api(grace).get('/api/v1/projects?sort=name:asc').expect(200);
    expect(all.body.data.map((p: { name: string }) => p.name)).toEqual(['Alpha API', 'Beta front']);
    expect(all.body.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });

    const archived = await api(grace).get('/api/v1/projects?status=ARCHIVED').expect(200);
    expect(archived.body.data.map((p: { name: string }) => p.name)).toEqual(['Gamma archive']);

    const withArchived = await api(grace).get('/api/v1/projects?includeArchived=true').expect(200);
    expect(withArchived.body.meta.total).toBe(3);

    const search = await api(grace).get('/api/v1/projects?q=FRONT').expect(200);
    expect(search.body.data.map((p: { name: string }) => p.name)).toEqual(['Beta front']);

    const page2 = await api(grace).get('/api/v1/projects?sort=name:asc&limit=1&page=2').expect(200);
    expect(page2.body.data.map((p: { name: string }) => p.name)).toEqual(['Beta front']);
    expect(page2.body.meta).toMatchObject({ total: 2, totalPages: 2 });
  });

  it('refuse des données et paramètres invalides (400, format commun)', async () => {
    const invalid = await api(ada)
      .post('/api/v1/projects', { name: '', repoUrl: 'pas-une-url', userId: 'pirate' })
      .expect(400);
    expect(invalid.body.path).toBe('/api/v1/projects');
    expect((invalid.body.message as string[]).join(' | ')).toContain('userId should not exist');

    const badSort = await api(ada).get('/api/v1/projects?sort=passwordHash:asc').expect(400);
    expect(badSort.body.message).toContain('Tri invalide');

    await api(ada).get('/api/v1/projects?limit=500').expect(400);
  });
});
