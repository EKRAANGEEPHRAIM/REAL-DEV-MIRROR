import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@search.e2e.devmirror.test';
const stamp = Date.now();

describe('Recherche globale (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ada: string;
  let grace: string;

  const get = (token: string, url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`);
  const post = (token: string, url: string, body: object) =>
    request(app.getHttpServer())
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

  async function signUp(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email: `search-${name}-${stamp}${EMAIL_DOMAIN}`, password: 'MotDePasse2026' })
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
      await post(ada, '/api/v1/projects', {
        name: 'Auth JWT',
        description: 'Authentification complète',
        color: '#6366f1',
      })
    ).body.id as string;
    await post(ada, '/api/v1/projects', { name: 'Portfolio', description: 'Site perso' });
    await post(ada, '/api/v1/tasks', { title: 'Rotation des refresh tokens', projectId: project });
    await post(ada, '/api/v1/tasks', { title: 'Écrire la doc', description: 'Expliquer le JWT' });
    await post(ada, '/api/v1/notes', {
      title: 'Pièges JWT',
      content: 'Un refresh token sert une fois.',
    });
    await post(grace, '/api/v1/notes', { title: 'JWT de Grace', content: 'privé' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('cherche dans les projets, les tâches et les notes, le titre en premier', async () => {
    const { body } = await get(ada, '/api/v1/search?q=jwt').expect(200);

    expect(body.q).toBe('jwt');
    expect(body.projects).toEqual([
      expect.objectContaining({ name: 'Auth JWT', color: '#6366f1', status: 'IDEA' }),
    ]);
    // Trouvée par sa description
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(['Écrire la doc']);
    expect(body.notes).toEqual([
      expect.objectContaining({ title: 'Pièges JWT', excerpt: 'Un refresh token sert une fois.' }),
    ]);
  });

  it('renvoie le projet d’une tâche et applique la limite par catégorie', async () => {
    const { body } = await get(ada, '/api/v1/search?q=refresh&limit=1').expect(200);

    expect(body.tasks).toEqual([
      expect.objectContaining({
        title: 'Rotation des refresh tokens',
        status: 'TODO',
        project: expect.objectContaining({ name: 'Auth JWT' }),
      }),
    ]);
    expect(body.notes).toHaveLength(1);
    expect(body.projects).toEqual([]);
  });

  it('n’expose jamais les données d’un autre utilisateur', async () => {
    const { body } = await get(grace, '/api/v1/search?q=jwt').expect(200);
    expect(body.projects).toEqual([]);
    expect(body.tasks).toEqual([]);
    expect(body.notes.map((n: { title: string }) => n.title)).toEqual(['JWT de Grace']);
  });

  it('valide la requête et exige une session', async () => {
    await get(ada, '/api/v1/search?q=a').expect(400);
    await get(ada, '/api/v1/search').expect(400);
    await get(ada, '/api/v1/search?q=jwt&limit=50').expect(400);
    await request(app.getHttpServer()).get('/api/v1/search?q=jwt').expect(401);
  });
});
