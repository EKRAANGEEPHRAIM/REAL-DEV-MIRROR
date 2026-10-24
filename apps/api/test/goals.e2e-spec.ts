import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@goals.e2e.devmirror.test';
const stamp = Date.now();

type Goal = {
  id: string;
  title: string;
  completed: boolean;
  progress: { total: number; done: number; percent: number };
  milestones: { id: string; title: string; done: boolean; position: number }[];
  projects: { id: string; name: string }[];
};

describe('Objectifs et jalons (e2e)', () => {
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
      .send({ name, email: `goals-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  const titles = async (query: string) =>
    (await api(ada).get(`/api/v1/goals?${query}`).expect(200)).body.data.map((g: Goal) => g.title);

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

    ids.api = (await api(ada).post('/api/v1/projects', { name: 'API' }).expect(201)).body.id;
    ids.web = (await api(ada).post('/api/v1/projects', { name: 'Web' }).expect(201)).body.id;
    ids.foreign = (
      await api(grace).post('/api/v1/projects', { name: 'Grace' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('crée un objectif avec ses jalons et ses projets', async () => {
    const response = await api(ada)
      .post('/api/v1/goals', {
        title: '  Lancer DevMirror ',
        description: '',
        targetDate: '2026-12-15',
        projectIds: [ids.web, ids.api],
        milestones: ['API terminée', ' ', 'Front terminé'],
      })
      .expect(201);
    const goal = response.body as Goal;
    ids.launch = goal.id;

    expect(goal).toMatchObject({
      title: 'Lancer DevMirror',
      description: null,
      completed: false,
      progress: { total: 2, done: 0, percent: 0 },
    });
    expect(goal.milestones.map((m) => [m.title, m.position])).toEqual([
      ['API terminée', 0],
      ['Front terminé', 1],
    ]);
    expect(goal.projects.map((p) => p.name)).toEqual(['API', 'Web']);
  });

  it('valide les données et refuse un projet d’un autre utilisateur', async () => {
    await api(ada).post('/api/v1/goals', { title: '' }).expect(400);
    await api(ada).post('/api/v1/goals', { title: 'X', targetDate: 'demain' }).expect(400);
    await api(ada)
      .post('/api/v1/goals', { title: 'X', projectIds: [ids.api, ids.api] })
      .expect(400);

    const response = await api(ada)
      .post('/api/v1/goals', { title: 'X', projectIds: [ids.api, ids.foreign] })
      .expect(400);
    expect(response.body.message).toBe('Un ou plusieurs projets sont introuvables');
  });

  it('coche les jalons : progression, objectif atteint et activité', async () => {
    const goal = (await api(ada).get(`/api/v1/goals/${ids.launch}`).expect(200)).body as Goal;
    const [first, second] = goal.milestones;
    const base = `/api/v1/goals/${ids.launch}/milestones`;

    await api(ada).patch(`${base}/${first.id}`, { done: true }).expect(200);
    let current = (await api(ada).get(`/api/v1/goals/${ids.launch}`)).body as Goal;
    expect(current.progress).toEqual({ total: 2, done: 1, percent: 50 });

    await api(ada).patch(`${base}/${second.id}`, { done: true }).expect(200);
    current = (await api(ada).get(`/api/v1/goals/${ids.launch}`)).body as Goal;
    expect(current).toMatchObject({ completed: true, progress: { percent: 100 } });
    expect(
      await prisma.activity.count({
        where: { entityId: { in: [first.id, second.id] }, type: 'MILESTONE_COMPLETED' },
      }),
    ).toBe(2);

    // Un nouveau jalon (ajouté en dernier) relance l'objectif
    const added = await api(ada).post(base, { title: 'Annonce' }).expect(201);
    expect(added.body).toMatchObject({ title: 'Annonce', done: false, position: 2 });
    current = (await api(ada).get(`/api/v1/goals/${ids.launch}`)).body as Goal;
    expect(current).toMatchObject({ completed: false, progress: { total: 3, percent: 67 } });

    await api(ada)
      .delete(`${base}/${added.body.id as string}`)
      .expect(204);
    expect((await api(ada).get(`/api/v1/goals/${ids.launch}`)).body.completed).toBe(true);
  });

  it('filtre par état, projet et recherche ; trie par date cible', async () => {
    await api(ada).post('/api/v1/goals', { title: 'Écrire le blog', targetDate: '2026-11-01' });
    await api(ada).post('/api/v1/goals', { title: 'Sans date', projectIds: [ids.api] });

    expect(await titles('')).toEqual(['Écrire le blog', 'Lancer DevMirror', 'Sans date']);
    expect(await titles('state=completed')).toEqual(['Lancer DevMirror']);
    expect(await titles('state=active')).toEqual(['Écrire le blog', 'Sans date']);
    expect(await titles(`projectId=${ids.api}&sort=title:desc`)).toEqual([
      'Sans date',
      'Lancer DevMirror',
    ]);
    expect(await titles('q=BLOG')).toEqual(['Écrire le blog']);
    await api(ada).get('/api/v1/goals?state=fini').expect(400);
    await api(ada).get('/api/v1/goals?sort=userId:asc').expect(400);
  });

  it('modifie un objectif : projectIds remplace la liste', async () => {
    const response = await api(ada)
      .patch(`/api/v1/goals/${ids.launch}`, { projectIds: [ids.api], targetDate: null })
      .expect(200);
    expect(response.body.projects.map((p: { name: string }) => p.name)).toEqual(['API']);
    expect(response.body.targetDate).toBeNull();

    const untouched = await api(ada)
      .patch(`/api/v1/goals/${ids.launch}`, { title: 'Lancer DevMirror v1' })
      .expect(200);
    expect(untouched.body.projects).toHaveLength(1);
    await api(ada)
      .patch(`/api/v1/goals/${ids.launch}`, { projectIds: [ids.foreign] })
      .expect(400);
  });

  it('isole les objectifs et les jalons d’un autre utilisateur (404)', async () => {
    const goal = (await api(ada).get(`/api/v1/goals/${ids.launch}`)).body as Goal;
    const milestone = goal.milestones[0].id;

    expect((await api(grace).get('/api/v1/goals').expect(200)).body.data).toEqual([]);
    await api(grace).get(`/api/v1/goals/${ids.launch}`).expect(404);
    await api(grace).patch(`/api/v1/goals/${ids.launch}`, { title: 'Volé' }).expect(404);
    await api(grace).delete(`/api/v1/goals/${ids.launch}`).expect(404);
    await api(grace).post(`/api/v1/goals/${ids.launch}/milestones`, { title: 'X' }).expect(404);
    await api(grace)
      .patch(`/api/v1/goals/${ids.launch}/milestones/${milestone}`, { done: false })
      .expect(404);

    // Bon propriétaire mais mauvais objectif parent
    const other = (await api(ada).post('/api/v1/goals', { title: 'Autre' }).expect(201)).body.id;
    await api(ada)
      .patch(`/api/v1/goals/${other as string}/milestones/${milestone}`, { done: false })
      .expect(404);
  });

  it('supprime l’objectif et ses jalons, sans toucher aux projets', async () => {
    await api(ada).delete(`/api/v1/goals/${ids.launch}`).expect(204);
    await api(ada).get(`/api/v1/goals/${ids.launch}`).expect(404);
    expect(await prisma.milestone.count({ where: { goalId: ids.launch } })).toBe(0);
    await api(ada).get(`/api/v1/projects/${ids.api}`).expect(200);
  });
});
