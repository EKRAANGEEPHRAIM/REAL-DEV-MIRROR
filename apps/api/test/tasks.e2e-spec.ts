import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@tasks.e2e.devmirror.test';
const stamp = Date.now();
const DAY = 24 * 3600 * 1000;

describe('Tâches (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;
  let projectId: string;

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
      .send({ name, email: `tasks-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
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
    projectId = (await api(ada).post('/api/v1/projects', { name: 'Kanban' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('crée des tâches rattachées au projet, en bas de leur colonne', async () => {
    const first = await api(ada)
      .post('/api/v1/tasks', { title: 'Première', projectId })
      .expect(201);
    const second = await api(ada)
      .post('/api/v1/tasks', { title: 'Seconde', projectId, priority: 'HIGH' })
      .expect(201);

    expect(first.body).toMatchObject({
      title: 'Première',
      status: 'TODO',
      priority: 'MEDIUM',
      position: 0,
      completedAt: null,
      project: { id: projectId, name: 'Kanban' },
      subtasks: [],
    });
    expect(second.body.position).toBe(1);
  });

  it('passer à DONE renseigne completedAt, crée une activité et fait progresser le projet', async () => {
    const created = await api(ada)
      .post('/api/v1/tasks', { title: 'À terminer', projectId })
      .expect(201);
    const id = created.body.id as string;

    const done = await api(ada).patch(`/api/v1/tasks/${id}`, { status: 'DONE' }).expect(200);
    expect(done.body.completedAt).toEqual(expect.any(String));

    const activity = await prisma.activity.findFirst({
      where: { entityId: id, type: 'TASK_COMPLETED' },
    });
    expect(activity).not.toBeNull();

    const project = await api(ada).get(`/api/v1/projects/${projectId}`).expect(200);
    expect(project.body.progress).toEqual({ total: 3, done: 1, percent: 33 });

    const reopened = await api(ada).patch(`/api/v1/tasks/${id}`, { status: 'TODO' }).expect(200);
    expect(reopened.body.completedAt).toBeNull();
  });

  it('filtre par statut, priorité, échéance, retard et recherche', async () => {
    const now = Date.now();
    await api(ada)
      .post('/api/v1/tasks', { title: 'En retard', dueDate: new Date(now - 2 * DAY).toISOString() })
      .expect(201);
    await api(ada)
      .post('/api/v1/tasks', {
        title: 'Cette semaine',
        dueDate: new Date(now + 2 * DAY).toISOString(),
      })
      .expect(201);

    const titles = async (query: string) =>
      (await api(ada).get(`/api/v1/tasks?${query}`).expect(200)).body.data.map(
        (t: { title: string }) => t.title,
      );

    expect(await titles('overdue=true')).toEqual(['En retard']);
    expect(
      await titles(
        `dueFrom=${new Date(now).toISOString()}&dueTo=${new Date(now + 7 * DAY).toISOString()}`,
      ),
    ).toEqual(['Cette semaine']);
    expect(await titles('priority=HIGH')).toEqual(['Seconde']);
    expect(await titles('q=SEMAINE')).toEqual(['Cette semaine']);
    expect(await titles(`projectId=${projectId}&sort=position:asc&status=TODO`)).toEqual([
      'Première',
      'Seconde',
      'À terminer',
    ]);
    expect((await titles('withoutProject=true&sort=dueDate:asc'))[0]).toBe('En retard');
  });

  it('isole les tâches et refuse le projet d’un autre utilisateur', async () => {
    const { body } = await api(ada).post('/api/v1/tasks', { title: 'Secrète' }).expect(201);
    const url = `/api/v1/tasks/${body.id as string}`;

    await api(grace).get(url).expect(404);
    await api(grace).patch(url, { title: 'Volée' }).expect(404);
    await api(grace).delete(url).expect(404);
    const list = await api(grace).get('/api/v1/tasks').expect(200);
    expect(list.body.meta.total).toBe(0);

    const intrusion = await api(grace)
      .post('/api/v1/tasks', { title: 'Intruse', projectId })
      .expect(400);
    expect(intrusion.body.message).toBe('Projet introuvable');
  });

  it('refuse des données invalides (400)', async () => {
    const response = await api(ada)
      .post('/api/v1/tasks', { title: '', status: 'FINI', dueDate: 'demain' })
      .expect(400);
    const messages = (response.body.message as string[]).join(' | ');
    expect(messages).toContain('Le titre doit contenir');
    expect(messages).toContain('Statut invalide');
    expect(messages).toContain('Échéance invalide');
  });

  it('supprimer le projet supprime ses tâches', async () => {
    await api(ada).delete(`/api/v1/projects/${projectId}`).expect(204);

    const remaining = await api(ada).get(`/api/v1/tasks?projectId=${projectId}`).expect(200);
    expect(remaining.body.meta.total).toBe(0);
  });
});
