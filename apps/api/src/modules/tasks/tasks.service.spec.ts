import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Priority, TaskStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { visibleTasks } from '../projects/project-access.js';
import { READ_ONLY_PROJECT, type ProjectsService } from '../projects/projects.service.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TASK_LEAVE_PROJECT, TasksService } from './tasks.service.js';

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  userId: 'user-1',
  title: 'Tâche',
  description: null,
  status: TaskStatus.TODO,
  priority: Priority.MEDIUM,
  dueDate: null,
  position: 0,
  completedAt: null,
  projectId: null,
  project: null,
  subtasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TasksService', () => {
  const tx = {
    task: { create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    activity: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    task: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  };
  const projects = { assertCanEdit: vi.fn() };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    projects as unknown as ProjectsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Tableau d'opérations (lecture) ou fonction interactive (écriture)
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    );
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    tx.task.aggregate.mockResolvedValue({ _max: { position: 4 } });
  });

  describe('findAll', () => {
    const query = (input: Record<string, unknown>) => plainToInstance(TaskQueryDto, input);

    it('combine projet, statut, priorité, recherche et bornes d’échéance', async () => {
      await service.findAll(
        'user-1',
        query({
          projectId: 'p1',
          status: 'TODO',
          priority: 'HIGH',
          q: 'tests',
          dueFrom: '2026-10-22T00:00:00.000Z',
          dueTo: '2026-10-29T00:00:00.000Z',
        }),
      );

      expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
        AND: [
          visibleTasks('user-1'),
          { projectId: 'p1' },
          { status: TaskStatus.TODO },
          { priority: Priority.HIGH },
          { title: { contains: 'tests', mode: 'insensitive' } },
          { dueDate: { gte: new Date('2026-10-22T00:00:00.000Z') } },
          { dueDate: { lt: new Date('2026-10-29T00:00:00.000Z') } },
        ],
      });
    });

    it('« en retard » = échéance passée et tâche non terminée', async () => {
      await service.findAll('user-1', query({ overdue: 'true' }));

      const { AND } = prisma.task.findMany.mock.calls[0][0].where;
      expect(AND).toContainEqual({ status: { not: TaskStatus.DONE } });
      expect(AND).toContainEqual({ dueDate: { lt: expect.any(Date) } });
    });

    it('trie par échéance en plaçant les tâches sans échéance à la fin', async () => {
      await service.findAll('user-1', query({ sort: 'dueDate:asc' }));

      expect(prisma.task.findMany.mock.calls[0][0].orderBy).toEqual([
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ]);
    });
  });

  describe('create', () => {
    it('vérifie le droit d’écrire dans le projet, place la tâche en bas de la colonne commune', async () => {
      tx.task.create.mockResolvedValue(task());

      await service.create('user-1', { title: 'Tâche', projectId: 'p1' });

      expect(projects.assertCanEdit).toHaveBeenCalledWith('user-1', 'p1');
      // Colonne partagée par l'équipe : pas de filtre par auteur
      expect(tx.task.aggregate.mock.calls[0][0].where).toEqual({
        projectId: 'p1',
        status: TaskStatus.TODO,
      });
      expect(tx.task.create.mock.calls[0][0].data).toMatchObject({
        position: 5,
        completedAt: null,
      });
      expect(tx.activity.create).not.toHaveBeenCalled();
    });

    it('sans projet, la colonne est propre à l’utilisateur', async () => {
      tx.task.create.mockResolvedValue(task());

      await service.create('user-1', { title: 'Perso' });

      expect(projects.assertCanEdit).not.toHaveBeenCalled();
      expect(tx.task.aggregate.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        projectId: null,
        status: TaskStatus.TODO,
      });
    });

    it('refuse un projet où il ne peut pas écrire', async () => {
      projects.assertCanEdit.mockRejectedValueOnce(new BadRequestException('Projet introuvable'));

      await expect(service.create('user-1', { title: 'X', projectId: 'p-autre' })).rejects.toThrow(
        'Projet introuvable',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update : transitions de statut', () => {
    it('passer à DONE renseigne completedAt et enregistre une activité', async () => {
      prisma.task.findFirst.mockResolvedValue({ status: TaskStatus.IN_PROGRESS, projectId: null });
      tx.task.update.mockResolvedValue(task({ status: TaskStatus.DONE }));

      await service.update('user-1', 't1', { status: TaskStatus.DONE });

      const { data } = tx.task.update.mock.calls[0][0];
      expect(data.completedAt).toBeInstanceOf(Date);
      expect(data.position).toBe(5);
      expect(tx.activity.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', type: 'TASK_COMPLETED', entityType: 'TASK', entityId: 't1' },
      });
    });

    it('quitter DONE efface completedAt, sans nouvelle activité', async () => {
      prisma.task.findFirst.mockResolvedValue({ status: TaskStatus.DONE, projectId: null });
      tx.task.update.mockResolvedValue(task());

      await service.update('user-1', 't1', { status: TaskStatus.TODO });

      expect(tx.task.update.mock.calls[0][0].data.completedAt).toBeNull();
      expect(tx.activity.create).not.toHaveBeenCalled();
    });

    it('modifier le titre ne touche ni à completedAt ni à la position', async () => {
      prisma.task.findFirst.mockResolvedValue({ status: TaskStatus.DONE, projectId: null });
      tx.task.update.mockResolvedValue(task());

      await service.update('user-1', 't1', { title: 'Nouveau titre' });

      const { data } = tx.task.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('completedAt');
      expect(data).not.toHaveProperty('position');
    });

    it('renvoie 404 pour la tâche d’un autre utilisateur', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 't-autre', { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('droits d’équipe', () => {
    it('remove : tâche invisible → 404, rien n’est supprimé', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.count.mockResolvedValue(0);

      await expect(service.remove('user-1', 't1')).rejects.toThrow('Tâche introuvable');
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('un lecteur voit la tâche mais ne peut ni la modifier ni la supprimer (403)', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.count.mockResolvedValue(1);

      await expect(service.update('user-1', 't1', { title: 'x' })).rejects.toThrow(
        new ForbiddenException(READ_ONLY_PROJECT),
      );
      await expect(service.remove('user-1', 't1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('un éditeur supprime la tâche d’un coéquipier dans le projet', async () => {
      prisma.task.findFirst.mockResolvedValue({
        status: TaskStatus.TODO,
        projectId: 'p1',
        userId: 'user-2',
      });

      await service.remove('user-1', 't1');
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('seul l’auteur peut retirer une tâche du projet (sinon elle disparaîtrait pour l’équipe)', async () => {
      prisma.task.findFirst.mockResolvedValue({
        status: TaskStatus.TODO,
        projectId: 'p1',
        userId: 'user-2',
      });

      await expect(service.update('user-1', 't1', { projectId: null })).rejects.toThrow(
        new ForbiddenException(TASK_LEAVE_PROJECT),
      );
      expect(tx.task.update).not.toHaveBeenCalled();
    });
  });
});
