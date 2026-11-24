import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService, type MailMessage } from './../src/modules/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Domaine propre à cette suite : les fichiers e2e tournent en parallèle.
const EMAIL_DOMAIN = '@members.e2e.devmirror.test';
const stamp = Date.now();
const emailOf = (name: string) => `members-${name}-${stamp}${EMAIL_DOMAIN}`;

/**
 * Parcours d'une équipe : Ada invite Grace (éditrice) et Linus (lecteur) sur son projet,
 * chacun accepte depuis le lien reçu par email, puis on vérifie ce que chacun peut faire.
 */
describe('Équipes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sent: MailMessage[] = [];
  const tokens: Record<string, string> = {};

  async function signUp(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email: emailOf(name), password: 'MotDePasse2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  const api = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`),
  });

  /** Jeton du dernier email d'invitation envoyé à cette personne. */
  function invitationToken(name: string): string {
    const message = sent.filter((mail) => mail.to === emailOf(name)).at(-1)!;
    return /invitations\/([\w-]+)/.exec(message.text)![1];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async (message: MailMessage) => void sent.push(message) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const name of ['ada', 'grace', 'linus', 'mallory']) tokens[name] = await signUp(name);
  });

  afterAll(async () => {
    // La cascade supprime projets, membres, invitations et tâches des comptes de test.
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await app.close();
  });

  it('du projet solo à l’équipe : invitations, rôles et droits de chacun', async () => {
    const ada = api(tokens.ada);
    const grace = api(tokens.grace);
    const linus = api(tokens.linus);
    const mallory = api(tokens.mallory);

    const project = await ada.post('/api/v1/projects', { name: 'Équipe' }).expect(201);
    const projectId = project.body.id as string;
    expect(project.body).toMatchObject({ role: 'OWNER', memberCount: 0 });

    // Un inconnu ne voit pas le projet
    await grace.get(`/api/v1/projects/${projectId}`).expect(404);

    // Invitations : seule Ada peut inviter
    await ada
      .post(`/api/v1/projects/${projectId}/invitations`, { email: emailOf('grace') })
      .expect(201);
    await ada
      .post(`/api/v1/projects/${projectId}/invitations`, {
        email: emailOf('linus'),
        role: 'VIEWER',
      })
      .expect(201);
    await grace
      .post(`/api/v1/projects/${projectId}/invitations`, { email: emailOf('mallory') })
      .expect(404);

    // Un lien transféré ne fonctionne pas pour un autre compte
    await mallory.post(`/api/v1/invitations/token/${invitationToken('grace')}/accept`).expect(403);

    // Chacun voit son invitation dans l'application, puis l'accepte depuis le lien
    const received = await grace.get('/api/v1/invitations').expect(200);
    expect(received.body).toEqual([
      expect.objectContaining({
        role: 'EDITOR',
        project: expect.objectContaining({ id: projectId }),
      }),
    ]);
    await grace.post(`/api/v1/invitations/token/${invitationToken('grace')}/accept`).expect(200);
    await linus.post(`/api/v1/invitations/token/${invitationToken('linus')}/accept`).expect(200);
    // Le lien ne sert qu'une fois
    await grace.post(`/api/v1/invitations/token/${invitationToken('grace')}/accept`).expect(404);

    const team = await linus.get(`/api/v1/projects/${projectId}/members`).expect(200);
    expect(team.body.map((member: { role: string }) => member.role)).toEqual([
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);

    // Grace (éditrice) crée une tâche dans le projet ; Ada et Linus la voient
    const task = await grace
      .post('/api/v1/tasks', { title: 'Écrire les tests', projectId })
      .expect(201);
    const taskId = task.body.id as string;
    await ada.get(`/api/v1/tasks/${taskId}`).expect(200);
    await linus.get(`/api/v1/tasks/${taskId}`).expect(200);

    // Linus (lecteur) ne modifie ni la tâche, ni le projet, ni n'en crée
    await linus.patch(`/api/v1/tasks/${taskId}`, { title: 'x' }).expect(403);
    await linus.patch(`/api/v1/projects/${projectId}`, { name: 'x' }).expect(403);
    await linus.post('/api/v1/tasks', { title: 'x', projectId }).expect(400);

    // Ada déplace la tâche de Grace ; Grace ne peut pas supprimer le projet
    await ada.patch(`/api/v1/tasks/${taskId}`, { status: 'IN_PROGRESS' }).expect(200);
    await grace.delete(`/api/v1/projects/${projectId}`).expect(403);

    // Ada passe Linus éditeur : il peut maintenant écrire
    await ada
      .patch(`/api/v1/projects/${projectId}/members/${team.body[2].userId}`, { role: 'EDITOR' })
      .expect(200);
    await linus.patch(`/api/v1/tasks/${taskId}`, { status: 'DONE' }).expect(200);

    // Grace quitte le projet : elle n'y a plus accès
    await grace.delete(`/api/v1/projects/${projectId}/members/${team.body[1].userId}`).expect(204);
    await grace.get(`/api/v1/projects/${projectId}`).expect(404);
    await grace.get(`/api/v1/tasks/${taskId}`).expect(404);

    // Le propriétaire ne peut pas quitter son projet
    await ada.delete(`/api/v1/projects/${projectId}/members/${team.body[0].userId}`).expect(400);
  });
});
