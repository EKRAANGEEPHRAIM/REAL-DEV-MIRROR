import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@tags.e2e.devmirror.test';
const stamp = Date.now();

describe('Tags et projets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;

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

  async function signUp(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email: `tags-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

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
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('crée un tag normalisé et refuse un doublon, même avec une autre casse (409)', async () => {
    const created = await api(ada)
      .post('/api/v1/tags', { name: '  Angular ', color: '#dd0031' })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'angular',
      color: '#dd0031',
      usage: { projects: 0, notes: 0 },
    });

    const duplicate = await api(ada).post('/api/v1/tags', { name: 'ANGULAR' }).expect(409);
    expect(duplicate.body.message).toBe('Un tag porte déjà ce nom');

    // Le même nom reste libre pour un autre utilisateur
    await api(grace).post('/api/v1/tags', { name: 'angular' }).expect(201);
  });

  it('attache des tags à un projet, filtre par tag et compte leur utilisation', async () => {
    const nest = await api(ada).post('/api/v1/tags', { name: 'nestjs' }).expect(201);
    const { body: tags } = await api(ada).get('/api/v1/tags').expect(200);
    const angularId = (tags as { id: string; name: string }[]).find(
      (t) => t.name === 'angular',
    )!.id;

    const project = await api(ada)
      .post('/api/v1/projects', { name: 'API Nest', tagIds: [nest.body.id, angularId] })
      .expect(201);
    expect(project.body.tags.map((t: { name: string }) => t.name)).toEqual(['angular', 'nestjs']);
    await api(ada).post('/api/v1/projects', { name: 'Sans tag' }).expect(201);

    const filtered = await api(ada).get('/api/v1/projects?tag=NestJS').expect(200);
    expect(filtered.body.data.map((p: { name: string }) => p.name)).toEqual(['API Nest']);

    const usage = await api(ada).get('/api/v1/tags').expect(200);
    expect(usage.body.find((t: { name: string }) => t.name === 'nestjs').usage.projects).toBe(1);

    // PATCH tagIds remplace la liste ; [] retire tout
    const replaced = await api(ada)
      .patch(`/api/v1/projects/${project.body.id as string}`, { tagIds: [angularId] })
      .expect(200);
    expect(replaced.body.tags.map((t: { name: string }) => t.name)).toEqual(['angular']);

    const untouched = await api(ada)
      .patch(`/api/v1/projects/${project.body.id as string}`, { name: 'API Nest v2' })
      .expect(200);
    expect(untouched.body.tags).toHaveLength(1);

    const cleared = await api(ada)
      .patch(`/api/v1/projects/${project.body.id as string}`, { tagIds: [] })
      .expect(200);
    expect(cleared.body.tags).toEqual([]);
  });

  it('refuse d’attacher le tag d’un autre utilisateur (400)', async () => {
    const graceTag = await api(grace).post('/api/v1/tags', { name: 'privé' }).expect(201);

    const response = await api(ada)
      .post('/api/v1/projects', { name: 'Intrus', tagIds: [graceTag.body.id] })
      .expect(400);
    expect(response.body.message).toBe('Un ou plusieurs tags sont introuvables');

    await api(ada)
      .patch(`/api/v1/tags/${graceTag.body.id as string}`, { name: 'volé' })
      .expect(404);
    await api(ada)
      .delete(`/api/v1/tags/${graceTag.body.id as string}`)
      .expect(404);
  });

  it('supprimer un tag le retire des projets sans supprimer les projets', async () => {
    const tag = await api(ada).post('/api/v1/tags', { name: 'éphémère' }).expect(201);
    const project = await api(ada)
      .post('/api/v1/projects', { name: 'Garde-moi', tagIds: [tag.body.id] })
      .expect(201);

    await api(ada)
      .delete(`/api/v1/tags/${tag.body.id as string}`)
      .expect(204);

    const after = await api(ada)
      .get(`/api/v1/projects/${project.body.id as string}`)
      .expect(200);
    expect(after.body.tags).toEqual([]);
  });

  it('renomme un tag et refuse un nom déjà pris (409)', async () => {
    const tag = await api(ada).post('/api/v1/tags', { name: 'angualr' }).expect(201);

    const renamed = await api(ada)
      .patch(`/api/v1/tags/${tag.body.id as string}`, { name: 'Vue' })
      .expect(200);
    expect(renamed.body.name).toBe('vue');

    await api(ada)
      .patch(`/api/v1/tags/${tag.body.id as string}`, { name: 'angular' })
      .expect(409);
  });
});
