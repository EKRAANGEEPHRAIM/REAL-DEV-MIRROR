import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { MAX_SUBTASKS_PER_TASK, SubtasksService } from './subtasks.service.js';
import { TasksService, UNKNOWN_TASKS } from './tasks.service.js';

describe('TasksService.reorder', () => {
  const tx = { task: { update: vi.fn() }, activity: { create: vi.fn() } };
  const prisma = {
    task: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const service = new TasksService(prisma as unknown as PrismaService, {} as ProjectsService);

  beforeEach(() => vi.clearAllMocks());

  it('réécrit les positions dans l’ordre reçu et ne met à jour que ce qui change', async () => {
    prisma.task.findMany
      .mockResolvedValueOnce([
        { id: 'a', status: TaskStatus.TODO, position: 0 },
        { id: 'b', status: TaskStatus.TODO, position: 1 },
        { id: 'c', status: TaskStatus.TODO, position: 2 },
      ])
      .mockResolvedValueOnce([]);

    // c remonte en tête ; a et b descendent d'un cran
    await service.reorder('user-1', { status: TaskStatus.TODO, taskIds: ['c', 'a', 'b'] });

    expect(tx.task.update.mock.calls.map(([args]) => [args.where.id, args.data.position])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
    expect(tx.task.update.mock.calls[0][0].data).not.toHaveProperty('completedAt');
  });

  it('ignore les tâches déjà à leur place', async () => {
    prisma.task.findMany
      .mockResolvedValueOnce([
        { id: 'a', status: TaskStatus.TODO, position: 0 },
        { id: 'b', status: TaskStatus.TODO, position: 1 },
      ])
      .mockResolvedValueOnce([]);

    await service.reorder('user-1', { status: TaskStatus.TODO, taskIds: ['a', 'b'] });

    expect(tx.task.update).not.toHaveBeenCalled();
  });

  it('déposer une carte dans DONE renseigne completedAt et enregistre l’activité', async () => {
    prisma.task.findMany
      .mockResolvedValueOnce([
        { id: 'a', status: TaskStatus.DONE, position: 0 },
        { id: 'b', status: TaskStatus.IN_PROGRESS, position: 3 },
      ])
      .mockResolvedValueOnce([]);

    await service.reorder('user-1', { status: TaskStatus.DONE, taskIds: ['a', 'b'] });

    expect(tx.task.update).toHaveBeenCalledTimes(1);
    expect(tx.task.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'b', userId: 'user-1' },
      data: { position: 1, status: TaskStatus.DONE, completedAt: expect.any(Date) },
    });
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
  });

  it('refuse tout si une tâche est inconnue ou appartient à un autre utilisateur', async () => {
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a', status: TaskStatus.TODO, position: 0 }]);

    await expect(
      service.reorder('user-1', { status: TaskStatus.TODO, taskIds: ['a', 'autre'] }),
    ).rejects.toThrow(new BadRequestException(UNKNOWN_TASKS));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('SubtasksService', () => {
  const prisma = {
    task: { count: vi.fn() },
    subtask: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const service = new SubtasksService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

  it('ajoute la sous-tâche en bas de la checklist', async () => {
    prisma.task.count.mockResolvedValue(1);
    prisma.subtask.count.mockResolvedValue(2);
    prisma.subtask.aggregate.mockResolvedValue({ _max: { position: 1 } });

    await service.create('user-1', 't1', { title: 'Cas limite' });

    expect(prisma.subtask.create.mock.calls[0][0].data).toEqual({
      taskId: 't1',
      title: 'Cas limite',
      position: 2,
    });
  });

  it('renvoie 404 si la tâche parente appartient à un autre utilisateur', async () => {
    prisma.task.count.mockResolvedValue(0);

    await expect(service.create('user-1', 't-autre', { title: 'X' })).rejects.toThrow(
      'Tâche introuvable',
    );
  });

  it(`refuse au-delà de ${MAX_SUBTASKS_PER_TASK} sous-tâches`, async () => {
    prisma.task.count.mockResolvedValue(1);
    prisma.subtask.count.mockResolvedValue(MAX_SUBTASKS_PER_TASK);
    prisma.subtask.aggregate.mockResolvedValue({ _max: { position: 49 } });

    await expect(service.create('user-1', 't1', { title: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('vérifie que la sous-tâche appartient à la tâche et à l’utilisateur', async () => {
    prisma.subtask.count.mockResolvedValue(0);

    await expect(service.update('user-1', 't1', 's9', { done: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.subtask.count).toHaveBeenCalledWith({
      where: { id: 's9', taskId: 't1', task: { userId: 'user-1' } },
    });
    expect(prisma.subtask.update).not.toHaveBeenCalled();
  });
});
