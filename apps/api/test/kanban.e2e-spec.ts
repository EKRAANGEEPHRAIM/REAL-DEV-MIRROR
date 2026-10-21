import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@kanban.e2e.devmirror.test';
const stamp = Date.now();

describe('Kanban et sous-tâches (e2e)', () => {
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
      .send({ name, email: `kanban-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  const column = async (status: string) =>
    (
      await api(ada)
        .get(`/api/v1/tasks?projectId=${ids.project}&status=${status}&sort=position:asc`)
        .expect(200)
    ).body.data.map((t: { title: string }) => t.title);

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

    ids.project = (await api(ada).post('/api/v1/projects', { name: 'Kanban' }).expect(201)).body.id;
    for (const title of ['A', 'B', 'C']) {
      ids[title] = (
        await api(ada).post('/api/v1/tasks', { title, projectId: ids.project }).expect(201)
      ).body.id;
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('réordonne une colonne', async () => {
    const response = await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'TODO', taskIds: [ids.C, ids.A, ids.B] })
      .expect(200);

    expect(
      response.body.map((t: { title: string; position: number }) => [t.title, t.position]),
    ).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ]);
    expect(await column('TODO')).toEqual(['C', 'A', 'B']);
  });

  it('déplace une carte vers « Terminé » : statut, position, completedAt et activité', async () => {
    await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'DONE', taskIds: [ids.A] })
      .expect(200);

    expect(await column('DONE')).toEqual(['A']);
    expect(await column('TODO')).toEqual(['C', 'B']);
    const task = await api(ada).get(`/api/v1/tasks/${ids.A}`).expect(200);
    expect(task.body).toMatchObject({ status: 'DONE', position: 0 });
    expect(task.body.completedAt).toEqual(expect.any(String));
    expect(
      await prisma.activity.count({ where: { entityId: ids.A, type: 'TASK_COMPLETED' } }),
    ).toBe(1);

    // Retour en colonne « En cours » : completedAt effacé
    await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'IN_PROGRESS', taskIds: [ids.A] })
      .expect(200);
    expect((await api(ada).get(`/api/v1/tasks/${ids.A}`)).body.completedAt).toBeNull();
  });

  it('refuse tout si une tâche appartient à un autre utilisateur, sans rien modifier', async () => {
    const intruder = (await api(grace).post('/api/v1/tasks', { title: 'Intrus' }).expect(201)).body
      .id;

    const response = await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'TODO', taskIds: [ids.B, intruder] })
      .expect(400);
    expect(response.body.message).toBe('Une ou plusieurs tâches sont introuvables');
    expect(await column('TODO')).toEqual(['C', 'B']);

    await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'TODO', taskIds: [ids.B, ids.B] })
      .expect(400);
    await api(ada)
      .patch('/api/v1/tasks/reorder', { status: 'FINI', taskIds: [ids.B] })
      .expect(400);
  });

  it('gère la checklist d’une tâche (ajout, coche, renommage, suppression, ordre)', async () => {
    const base = `/api/v1/tasks/${ids.B}/subtasks`;
    const first = await api(ada).post(base, { title: '  Cas nominal ' }).expect(201);
    const second = await api(ada).post(base, { title: 'Erreurs' }).expect(201);
    expect(first.body).toMatchObject({ title: 'Cas nominal', done: false, position: 0 });
    expect(second.body.position).toBe(1);

    await api(ada)
      .patch(`${base}/${first.body.id as string}`, { done: true, position: 1 })
      .expect(200);
    await api(ada)
      .patch(`${base}/${second.body.id as string}`, { title: 'Erreurs 4xx', position: 0 })
      .expect(200);

    const task = await api(ada).get(`/api/v1/tasks/${ids.B}`).expect(200);
    expect(
      task.body.subtasks.map((s: { title: string; done: boolean }) => [s.title, s.done]),
    ).toEqual([
      ['Erreurs 4xx', false],
      ['Cas nominal', true],
    ]);

    await api(ada)
      .delete(`${base}/${first.body.id as string}`)
      .expect(204);
    expect((await api(ada).get(`/api/v1/tasks/${ids.B}`)).body.subtasks).toHaveLength(1);
  });

  it('isole les sous-tâches : autre utilisateur ou autre tâche -> 404', async () => {
    const sub = (
      await api(ada).post(`/api/v1/tasks/${ids.C}/subtasks`, { title: 'Privée' }).expect(201)
    ).body.id as string;

    await api(grace).post(`/api/v1/tasks/${ids.C}/subtasks`, { title: 'Intrusion' }).expect(404);
    await api(grace).patch(`/api/v1/tasks/${ids.C}/subtasks/${sub}`, { done: true }).expect(404);
    await api(grace).delete(`/api/v1/tasks/${ids.C}/subtasks/${sub}`).expect(404);
    // Bon propriétaire mais mauvaise tâche parente
    await api(ada).patch(`/api/v1/tasks/${ids.B}/subtasks/${sub}`, { done: true }).expect(404);
  });
});
