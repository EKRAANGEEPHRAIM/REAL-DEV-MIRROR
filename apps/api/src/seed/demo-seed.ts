import { randomBytes } from 'node:crypto';
import { generateOpaqueToken, hashOpaqueToken } from '../common/crypto/opaque-token.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { buildDemoData, demoActivity } from './demo-data.js';
import { buildDemoTeam, type DemoTeamTask } from './demo-team.js';

export interface DemoSeedOptions {
  email: string;
  password: string;
  now?: Date;
}

export interface DemoSeedSummary {
  userId: string;
  projects: number;
  tasks: number;
  goals: number;
  notes: number;
  tags: number;
  activity: number;
  teammates: number;
  sharedProjects: number;
}

type Hasher = { hash(password: string): Promise<string> };

/**
 * (Re)crée le compte de démo et toutes ses données, en une transaction : l'ancien compte est
 * supprimé (ses données suivent en cascade), puis tout est recréé. Rejouable à volonté ; en
 * cas d'erreur, rien n'est modifié.
 */
export async function seedDemoAccount(
  prisma: PrismaClient,
  passwords: Hasher,
  { email, password, now = new Date() }: DemoSeedOptions,
): Promise<DemoSeedSummary> {
  const data = buildDemoData(now);
  const team = buildDemoTeam(now);
  const passwordHash = await passwords.hash(password);
  // Coéquipiers fictifs : empreinte d'un secret aléatoire jeté, donc aucune connexion possible.
  const lockedHash = await passwords.hash(randomBytes(32).toString('base64url'));

  return prisma.$transaction(
    async (tx) => {
      // Comptes de démo et coéquipiers fictifs : leurs données suivent en cascade.
      await tx.user.deleteMany({
        where: { email: { in: [email, ...team.teammates.map((teammate) => teammate.email)] } },
      });
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: data.user.name,
          bio: data.user.bio,
          links: {},
          preferences: { theme: 'system', language: 'fr' },
          // Vérifié : pas de bandeau de confirmation, aucun email à envoyer.
          emailVerified: true,
          createdAt: data.user.createdAt,
        },
      });
      const userId = user.id;

      const tags = await tx.tag.createManyAndReturn({
        data: data.tags.map((tag) => ({ ...tag, userId })),
      });
      const tagIds = (names: string[]) =>
        names.map((name) => ({ id: tags.find((tag) => tag.name === name)!.id }));

      const projectIds = new Map<string, string>();
      const projectIdList: string[] = [];
      for (const { key, tags: projectTags, ...project } of data.projects) {
        const created = await tx.project.create({
          data: { ...project, userId, tags: { connect: tagIds(projectTags) } },
        });
        projectIds.set(key, created.id);
        projectIdList.push(created.id);
      }

      // Écritures groupées : une base distante coûte un aller-retour par requête. Les lignes
      // créées sont retrouvées par leur titre (unique dans les données), pas par leur ordre.
      const createdTasks = await tx.task.createManyAndReturn({
        data: data.tasks.map(({ project, subtasks: _subtasks, ...task }) => ({
          ...task,
          userId,
          projectId: project ? projectIds.get(project) : null,
        })),
        select: { id: true, title: true },
      });
      const taskIds = data.tasks.map(
        (task) => createdTasks.find((t) => t.title === task.title)!.id,
      );
      await tx.subtask.createMany({
        data: data.tasks.flatMap((task, index) =>
          task.subtasks.map((subtask, position) => ({
            ...subtask,
            position,
            taskId: taskIds[index],
          })),
        ),
      });

      const milestoneIds: string[][] = [];
      for (const { key: _key, projects, milestones, ...goal } of data.goals) {
        const created = await tx.goal.create({
          data: {
            ...goal,
            userId,
            projects: { connect: projects.map((key) => ({ id: projectIds.get(key)! })) },
            milestones: {
              create: milestones.map(({ title, doneAt }, position) => ({
                title,
                done: doneAt !== null,
                position,
              })),
            },
          },
          include: { milestones: { orderBy: { position: 'asc' }, select: { id: true } } },
        });
        milestoneIds.push(created.milestones.map((m) => m.id));
      }

      const createdNotes = await tx.note.createManyAndReturn({
        data: data.notes.map(({ project, tags: _tags, ...note }) => ({
          ...note,
          userId,
          projectId: project ? projectIds.get(project) : null,
        })),
        select: { id: true, title: true },
      });
      const noteIds = data.notes.map(
        (note) => createdNotes.find((n) => n.title === note.title)!.id,
      );
      for (const [index, note] of data.notes.entries()) {
        if (note.tags.length === 0) continue;
        await tx.note.update({
          where: { id: noteIds[index] },
          data: { tags: { connect: tagIds(note.tags) } },
        });
      }

      const activity = demoActivity(data).map(({ type, entityType, ref, createdAt }) => ({
        userId,
        type,
        entityType,
        createdAt,
        entityId:
          ref.kind === 'project'
            ? projectIdList[ref.index]
            : ref.kind === 'task'
              ? taskIds[ref.index]
              : ref.kind === 'note'
                ? noteIds[ref.index]
                : milestoneIds[ref.index][ref.sub!],
      }));
      await tx.activity.createMany({ data: activity });

      const teammates = await seedTeam(tx, team, { userId, lockedHash, projectIds });

      return {
        userId,
        projects: projectIdList.length,
        tasks: taskIds.length,
        goals: milestoneIds.length,
        notes: noteIds.length,
        tags: tags.length,
        activity: activity.length,
        teammates,
        sharedProjects: 1,
      };
    },
    // Une centaine d'écritures vers une base distante : bien plus que les 15 s par défaut.
    { maxWait: 15_000, timeout: 120_000 },
  );
}

/**
 * Équipe fictive : coéquipiers sur les projets de Camille, un projet partagé avec elle,
 * des tâches écrites par d'autres et une invitation en attente. Renvoie le nombre de coéquipiers.
 */
async function seedTeam(
  tx: Prisma.TransactionClient,
  team: ReturnType<typeof buildDemoTeam>,
  context: { userId: string; lockedHash: string; projectIds: Map<string, string> },
): Promise<number> {
  const { userId, lockedHash, projectIds } = context;
  const users = await tx.user.createManyAndReturn({
    data: team.teammates.map(({ key: _key, ...teammate }) => ({
      ...teammate,
      passwordHash: lockedHash,
      links: {},
      preferences: {},
      emailVerified: true,
    })),
    select: { id: true, email: true },
  });
  const idOf = (key: string) =>
    key === 'demo'
      ? userId
      : users.find((user) => user.email === team.teammates.find((t) => t.key === key)!.email)!.id;

  await tx.projectMember.createMany({
    data: team.memberships.map(({ project, teammate, role, joinedAt }) => ({
      projectId: projectIds.get(project)!,
      userId: idOf(teammate),
      role,
      createdAt: joinedAt,
    })),
  });

  const taskData = (task: DemoTeamTask, projectId: string, position: number) => ({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    userId: idOf(task.author),
    projectId,
    position,
  });

  // Contributions dans les projets de Camille : en bas de leur colonne
  await tx.task.createMany({
    data: team.contributions.map((task, index) =>
      taskData(task, projectIds.get(task.project)!, 1000 + index),
    ),
  });

  const shared = team.sharedProject;
  const project = await tx.project.create({
    data: {
      name: shared.name,
      description: shared.description,
      status: 'IN_PROGRESS',
      techStack: shared.techStack,
      color: shared.color,
      createdAt: shared.createdAt,
      userId: idOf(shared.owner),
      members: {
        create: [
          { userId, role: shared.demoRole },
          ...shared.members.map(({ teammate, role }) => ({ userId: idOf(teammate), role })),
        ],
      },
    },
    select: { id: true },
  });
  const positions = new Map<string, number>();
  await tx.task.createMany({
    data: shared.tasks.map((task) => {
      const position = positions.get(task.status) ?? 0;
      positions.set(task.status, position + 1);
      return taskData(task, project.id, position);
    }),
  });

  const invitation = team.pendingInvitation;
  await tx.projectInvitation.create({
    data: {
      projectId: projectIds.get(invitation.project)!,
      email: invitation.email,
      role: invitation.role,
      // Jeton jamais envoyé : l'invitation sert seulement à l'affichage
      tokenHash: hashOpaqueToken(generateOpaqueToken()),
      invitedById: userId,
      createdAt: invitation.createdAt,
      expiresAt: new Date(invitation.createdAt.getTime() + 7 * 86_400_000),
    },
  });
  return users.length;
}
