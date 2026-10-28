import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@stats.e2e.devmirror.test';
const stamp = Date.now();
const DAY = 86_400_000;

describe('Statistiques (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;

  const get = (token: string, url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`);
  const send = (token: string, method: 'post' | 'patch', url: string, body: object) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`).send(body);

  async function signUp(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email: `stats-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
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

    const project = (
      await send(ada, 'post', '/api/v1/projects', { name: 'DevMirror', status: 'IN_PROGRESS' })
    ).body.id as string;
    await send(ada, 'post', '/api/v1/projects', { name: 'Idée', status: 'IDEA' });

    const inTwoDays = new Date(Date.now() + 2 * DAY).toISOString();
    const inTenDays = new Date(Date.now() + 10 * DAY).toISOString();
    const yesterday = new Date(Date.now() - DAY).toISOString();
    await send(ada, 'post', '/api/v1/tasks', {
      title: 'Démo',
      dueDate: inTwoDays,
      projectId: project,
    });
    await send(ada, 'post', '/api/v1/tasks', { title: 'Plus tard', dueDate: inTenDays });
    await send(ada, 'post', '/api/v1/tasks', { title: 'En retard', dueDate: yesterday });
    const done = (await send(ada, 'post', '/api/v1/tasks', { title: 'Faite', dueDate: inTwoDays }))
      .body.id as string;
    await send(ada, 'patch', `/api/v1/tasks/${done}`, { status: 'DONE' }).expect(200);

    await send(ada, 'post', '/api/v1/goals', { title: 'Lancer', milestones: ['API'] });
    await send(ada, 'post', '/api/v1/notes', { title: 'Note récente', content: '**JWT**' });
    // Une douzaine d'appels vers Neon : plus que les 30 s par défaut.
  }, 90_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('renvoie tout le tableau de bord en une requête', async () => {
    const { body } = await get(ada, '/api/v1/stats/overview?tz=Europe/Paris').expect(200);

    expect(body.timeZone).toBe('Europe/Paris');
    expect(body.indicators).toMatchObject({
      activeProjects: 1,
      openTasks: 3,
      tasksCompletedThisWeek: 1,
      overdueTasks: 1,
      activeGoals: 1,
      completedGoals: 0,
      notes: 1,
      currentStreak: 1,
    });
    expect(body.tasksCompletedPerWeek).toHaveLength(12);
    expect(body.tasksCompletedPerWeek.at(-1).count).toBe(1);
    expect(body.projectsByStatus).toEqual(
      expect.arrayContaining([
        { status: 'IN_PROGRESS', count: 1 },
        { status: 'IDEA', count: 1 },
        { status: 'ARCHIVED', count: 0 },
      ]),
    );
    // Ni la tâche terminée, ni celle dans 10 jours, ni celle en retard
    expect(body.dueSoon.map((t: { title: string }) => t.title)).toEqual(['Démo']);
    expect(body.dueSoon[0].project.name).toBe('DevMirror');
    expect(body.recentNotes).toEqual([
      expect.objectContaining({ title: 'Note récente', excerpt: 'JWT' }),
    ]);
  });

  it('compte l’activité du jour (projets, tâche terminée, note)', async () => {
    const { body } = await get(ada, '/api/v1/stats/activity?tz=Europe/Paris').expect(200);

    expect(body.days).toHaveLength(1);
    expect(body.days[0].date).toBe(body.to);
    // 2 projets créés, 1 tâche terminée, 1 note créée
    expect(body.total).toBe(4);
    expect(new Date(`${body.from}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('isole les données et valide le fuseau', async () => {
    const { body } = await get(grace, '/api/v1/stats/overview').expect(200);
    expect(body.timeZone).toBe('UTC');
    expect(body.indicators).toMatchObject({ activeProjects: 0, openTasks: 0, currentStreak: 0 });
    expect(body.dueSoon).toEqual([]);
    expect(body.activity.total).toBe(0);

    const invalid = await get(ada, '/api/v1/stats/overview?tz=Mars/Olympus').expect(400);
    // Erreur de validation : `message` liste les champs refusés.
    expect(invalid.body.message).toEqual([expect.stringContaining('Fuseau horaire inconnu')]);
    await request(app.getHttpServer()).get('/api/v1/stats/overview').expect(401);
  });
});
