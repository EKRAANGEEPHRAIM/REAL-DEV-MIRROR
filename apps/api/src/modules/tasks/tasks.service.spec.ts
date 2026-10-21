import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Priority, TaskStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TasksService } from './tasks.service.js';

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
    task: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  };
  const projects = { assertOwned: vi.fn() };
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
          { userId: 'user-1' },
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
    it('vérifie le projet, place la tâche en bas de sa colonne', async () => {
      tx.task.create.mockResolvedValue(task());

      await service.create('user-1', { title: 'Tâche', projectId: 'p1' });

      expect(projects.assertOwned).toHaveBeenCalledWith('user-1', 'p1');
      expect(tx.task.aggregate.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        projectId: 'p1',
        status: TaskStatus.TODO,
      });
      expect(tx.task.create.mock.calls[0][0].data).toMatchObject({
        position: 5,
        completedAt: null,
      });
      expect(tx.activity.create).not.toHaveBeenCalled();
    });

    it('refuse le projet d’un autre utilisateur', async () => {
      projects.assertOwned.mockRejectedValueOnce(new BadRequestException('Projet introuvable'));

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

  it('remove renvoie 404 si rien n’a été supprimé', async () => {
    prisma.task.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('user-1', 't1')).rejects.toThrow('Tâche introuvable');
    expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', userId: 'user-1' } });
  });
});
