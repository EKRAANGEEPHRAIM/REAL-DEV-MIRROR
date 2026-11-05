import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DEMO_EMAIL, DEMO_RESTRICTED_MESSAGE } from './../src/common/demo/demo-account.js';
import { PasswordService } from './../src/modules/auth/password.service.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { AvatarStorage } from './../src/modules/users/avatar-storage.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { seedDemoAccount } from './../src/seed/demo-seed.js';

// Seule suite à utiliser DEMO_EMAIL : le seed supprime puis recrée ce compte.
const PASSWORD = 'DemoE2e2026';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Compte de démo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  const sentMails: unknown[] = [];
  const avatars = { enabled: true, upload: vi.fn(), remove: vi.fn() };

  const get = (url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`);
  const authed = (method: 'post' | 'patch' | 'delete', url: string) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async (mail: unknown) => void sentMails.push(mail) })
      .overrideProvider(AvatarStorage)
      .useValue(avatars)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await seedDemoAccount(prisma, new PasswordService(), { email: DEMO_EMAIL, password: PASSWORD });
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_EMAIL, password: PASSWORD })
      .expect(200);
    token = body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
    await app.close();
  });

  it('se connecte sur un compte vérifié, rempli et actif depuis trois mois', async () => {
    const { body: me } = await get('/api/v1/users/me').expect(200);
    expect(me).toMatchObject({ email: DEMO_EMAIL, emailVerified: true });

    const { body: overview } = await get('/api/v1/stats/overview?tz=Europe/Paris').expect(200);
    expect(overview.indicators).toMatchObject({
      activeProjects: 3,
      overdueTasks: 2,
      completedGoals: 1,
      activeGoals: 2,
      notes: 8,
    });
    expect(overview.indicators.currentStreak).toBeGreaterThanOrEqual(2);
    const completed = overview.tasksCompletedPerWeek.reduce(
      (sum: number, week: { count: number }) => sum + week.count,
      0,
    );
    expect(completed).toBeGreaterThanOrEqual(20);
    expect(overview.dueSoon.length).toBeGreaterThanOrEqual(4);
    expect(overview.recentNotes.length).toBeGreaterThan(0);

    const { body: activity } = await get('/api/v1/stats/activity?tz=Europe/Paris').expect(200);
    expect(activity.total).toBeGreaterThanOrEqual(45);
    // Trois mois d'activité : le premier jour actif remonte à plus de 80 jours.
    const first = new Date(`${activity.days[0].date}T12:00:00Z`).getTime();
    expect((Date.now() - first) / 86_400_000).toBeGreaterThan(80);

    const { body: projects } = await get('/api/v1/projects').expect(200);
    expect(projects.meta.total).toBe(6);
    const { body: search } = await get('/api/v1/search?q=refresh').expect(200);
    expect(search.notes.length).toBeGreaterThan(0);
  });

  it('rejouer le seed remet le compte à zéro sans dupliquer les données', async () => {
    await authed('post', '/api/v1/projects').send({ name: 'Projet d’un visiteur' }).expect(201);

    await seedDemoAccount(prisma, new PasswordService(), { email: DEMO_EMAIL, password: PASSWORD });
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_EMAIL, password: PASSWORD })
      .expect(200);
    token = body.accessToken as string;

    const { body: projects } = await get('/api/v1/projects?q=visiteur').expect(200);
    expect(projects.meta.total).toBe(0);
    expect(await prisma.user.count({ where: { email: DEMO_EMAIL } })).toBe(1);
  }, 120_000); // un seed complet vers une base distante

  it('les visiteurs modifient les données, pas le compte', async () => {
    const forbidden = (response: request.Response) => {
      expect(response.status).toBe(403);
      expect(response.body.message).toBe(DEMO_RESTRICTED_MESSAGE);
    };

    forbidden(
      await authed('post', '/api/v1/auth/change-password').send({
        currentPassword: PASSWORD,
        newPassword: 'Autre2026xyz',
      }),
    );
    forbidden(await authed('delete', '/api/v1/users/me').send({ password: PASSWORD }));
    forbidden(await authed('patch', '/api/v1/users/me').send({ name: 'Pirate' }));
    forbidden(await authed('patch', '/api/v1/users/me').send({ bio: 'Défiguré' }));
    forbidden(await authed('post', '/api/v1/users/me/avatar').attach('avatar', PNG, 'a.png'));
    forbidden(await authed('delete', '/api/v1/users/me/avatar'));
    forbidden(await authed('post', '/api/v1/auth/logout-all'));
    expect(avatars.upload).not.toHaveBeenCalled();

    // Préférences (thème, langue) et données : permis.
    const { body } = await authed('patch', '/api/v1/users/me')
      .send({ preferences: { theme: 'dark' } })
      .expect(200);
    expect(body.preferences.theme).toBe('dark');
    await authed('post', '/api/v1/tasks').send({ title: 'Essai d’un visiteur' }).expect(201);

    // Le mot de passe public fonctionne toujours.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('aucun email de réinitialisation pour le compte de démo', async () => {
    const before = sentMails.length;
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: DEMO_EMAIL })
      .expect(202);

    expect(sentMails.length).toBe(before);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
    expect(await prisma.authToken.count({ where: { userId: user.id } })).toBe(0);
  });
});
