import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@notes.e2e.devmirror.test';
const stamp = Date.now();

type Note = {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  pinned: boolean;
  project: { id: string; name: string } | null;
  tags: { id: string; name: string }[];
};

describe('Notes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;
  const ids: Record<string, string> = {};

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
      .send({ name, email: `notes-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  const titles = async (query: string) =>
    (await api(ada).get(`/api/v1/notes?${query}`).expect(200)).body.data.map((n: Note) => n.title);

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

    ids.project = (
      await api(ada).post('/api/v1/projects', { name: 'DevMirror' }).expect(201)
    ).body.id;
    ids.nest = (await api(ada).post('/api/v1/tags', { name: 'NestJS' }).expect(201)).body.id;
    ids.angular = (await api(ada).post('/api/v1/tags', { name: 'angular' }).expect(201)).body.id;
    ids.foreignTag = (await api(grace).post('/api/v1/tags', { name: 'privé' }).expect(201)).body.id;
    ids.foreignProject = (
      await api(grace).post('/api/v1/projects', { name: 'G' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('crée une note avec projet et tags ; la liste renvoie un extrait sans le contenu', async () => {
    const content =
      '## Rotation\n\nUn **refresh token** ne sert qu’une fois.\n\n```ts\nrotate();\n```';
    const created = await api(ada)
      .post('/api/v1/notes', {
        title: '  Pièges du rafraîchissement JWT ',
        content,
        projectId: ids.project,
        tagIds: [ids.nest],
      })
      .expect(201);
    ids.jwt = created.body.id;

    expect(created.body).toMatchObject({
      title: 'Pièges du rafraîchissement JWT',
      content,
      pinned: false,
      project: { id: ids.project, name: 'DevMirror' },
      tags: [{ name: 'nestjs' }],
    });
    expect(
      await prisma.activity.count({ where: { entityId: ids.jwt, type: 'NOTE_CREATED' } }),
    ).toBe(1);

    const list = await api(ada).get('/api/v1/notes').expect(200);
    expect(list.body.data[0]).not.toHaveProperty('content');
    expect(list.body.data[0].excerpt).toBe('Rotation Un refresh token ne sert qu’une fois.');
    expect((await api(ada).get(`/api/v1/notes/${ids.jwt}`).expect(200)).body.content).toBe(content);
  });

  it('valide les données et refuse un projet ou un tag d’un autre utilisateur', async () => {
    await api(ada).post('/api/v1/notes', { title: ' ' }).expect(400);
    await api(ada)
      .post('/api/v1/notes', { title: 'X', content: 'a'.repeat(30_001) })
      .expect(400);
    await api(ada).post('/api/v1/notes', { title: 'X', projectId: ids.foreignProject }).expect(400);
    const response = await api(ada)
      .post('/api/v1/notes', { title: 'X', tagIds: [ids.foreignTag] })
      .expect(400);
    expect(response.body.message).toBe('Un ou plusieurs tags sont introuvables');
  });

  it('recherche plein texte : racines françaises, début de mot, pertinence', async () => {
    await api(ada).post('/api/v1/notes', {
      title: 'Signals Angular',
      content: 'Les signaux remplacent les tests de détection de changement.',
      tagIds: [ids.angular],
    });
    await api(ada).post('/api/v1/notes', {
      title: 'Courses',
      content: 'Penser à acheter du café. Parler du token au JWT meetup.',
    });

    // « tester » et « tests » ont la même racine
    expect(await titles('q=tester')).toEqual(['Signals Angular']);
    // Début de mot (sous-chaîne)
    expect(await titles('q=rafra')).toEqual(['Pièges du rafraîchissement JWT']);
    // Le titre pèse plus que le contenu
    expect(await titles('q=jwt')).toEqual(['Pièges du rafraîchissement JWT', 'Courses']);
    // Syntaxe web : exclusion
    expect(await titles('q=token -café')).toEqual(['Pièges du rafraîchissement JWT']);
    // Les jokers SQL saisis sont cherchés littéralement
    expect(await titles('q=%25')).toEqual([]);
  });

  it('épingle une note : elle passe en tête ; filtres projet, tag et épinglage', async () => {
    const courses = (await titles('q=courses')).length;
    expect(courses).toBe(1);
    const all = (await api(ada).get('/api/v1/notes').expect(200)).body.data as Note[];
    const coursesId = all.find((n) => n.title === 'Courses')!.id;

    await api(ada).patch(`/api/v1/notes/${coursesId}`, { pinned: true }).expect(200);
    expect((await titles(''))[0]).toBe('Courses');
    expect((await titles('q=jwt'))[0]).toBe('Courses');
    expect(await titles('pinned=true')).toEqual(['Courses']);
    expect(await titles(`projectId=${ids.project}`)).toEqual(['Pièges du rafraîchissement JWT']);
    expect(await titles('tag=ANGULAR')).toEqual(['Signals Angular']);
    expect(await titles('sort=title:asc&pinned=false')).toEqual([
      'Pièges du rafraîchissement JWT',
      'Signals Angular',
    ]);
    await api(ada).get('/api/v1/notes?pinned=peut-être').expect(400);
    await api(ada).get('/api/v1/notes?sort=content:asc').expect(400);
  });

  it('modifie une note : tags remplacés, projet détaché', async () => {
    const response = await api(ada)
      .patch(`/api/v1/notes/${ids.jwt}`, { tagIds: [ids.angular], projectId: null })
      .expect(200);
    expect(response.body.tags.map((t: { name: string }) => t.name)).toEqual(['angular']);
    expect(response.body.project).toBeNull();

    const kept = await api(ada).patch(`/api/v1/notes/${ids.jwt}`, { title: 'JWT' }).expect(200);
    expect(kept.body.tags).toHaveLength(1);
  });

  it('isole les notes d’un autre utilisateur (404, absentes des recherches)', async () => {
    expect((await api(grace).get('/api/v1/notes?q=jwt').expect(200)).body.data).toEqual([]);
    await api(grace).get(`/api/v1/notes/${ids.jwt}`).expect(404);
    await api(grace).patch(`/api/v1/notes/${ids.jwt}`, { pinned: true }).expect(404);
    await api(grace).delete(`/api/v1/notes/${ids.jwt}`).expect(404);
  });

  it('supprimer le projet détache ses notes ; supprimer une note', async () => {
    const note = (
      await api(ada).post('/api/v1/notes', { title: 'Liée', projectId: ids.project }).expect(201)
    ).body.id as string;
    await api(ada).delete(`/api/v1/projects/${ids.project}`).expect(204);
    expect((await api(ada).get(`/api/v1/notes/${note}`).expect(200)).body.project).toBeNull();

    await api(ada).delete(`/api/v1/notes/${note}`).expect(204);
    await api(ada).get(`/api/v1/notes/${note}`).expect(404);
  });
});
