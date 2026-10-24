import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { MAX_MILESTONES_PER_GOAL } from './dto/goal.dto.js';
import { GOAL_NOT_FOUND, GoalsService, toGoalResponse } from './goals.service.js';
import { MILESTONE_NOT_FOUND, MilestonesService } from './milestones.service.js';

const goal = (milestones: { done: boolean }[]) => ({
  id: 'g1',
  title: 'Lancer DevMirror',
  description: null,
  targetDate: null,
  userId: 'user-1',
  milestones: milestones.map((m, position) => ({ id: `m${position}`, title: 'J', position, ...m })),
  projects: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('toGoalResponse', () => {
  it('calcule la progression à partir des jalons', () => {
    const response = toGoalResponse(goal([{ done: true }, { done: false }, { done: false }]));
    expect(response.progress).toEqual({ total: 3, done: 1, percent: 33 });
    expect(response.completed).toBe(false);
  });

  it('un objectif sans jalon est à 0 % et non atteint', () => {
    const response = toGoalResponse(goal([]));
    expect(response.progress).toEqual({ total: 0, done: 0, percent: 0 });
    expect(response.completed).toBe(false);
  });

  it('tous les jalons faits : 100 % et atteint', () => {
    const response = toGoalResponse(goal([{ done: true }, { done: true }]));
    expect(response.progress.percent).toBe(100);
    expect(response.completed).toBe(true);
  });
});

describe('GoalsService', () => {
  const prisma = {
    goal: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const projects = { assertAllOwned: vi.fn() };
  const service = new GoalsService(
    prisma as unknown as PrismaService,
    projects as unknown as ProjectsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.goal.findMany.mockResolvedValue([]);
    prisma.goal.count.mockResolvedValue(0);
    prisma.goal.create.mockResolvedValue(goal([]));
    prisma.goal.update.mockResolvedValue(goal([]));
  });

  it('filtre « atteints » : au moins un jalon, tous faits', async () => {
    await service.findAll('user-1', { page: 1, limit: 20, state: 'completed' });
    expect(prisma.goal.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ userId: 'user-1' }, { milestones: { some: {}, every: { done: true } } }],
    });
  });

  it('trie par date cible en plaçant les objectifs sans date à la fin', async () => {
    await service.findAll('user-1', { page: 1, limit: 20 });
    expect(prisma.goal.findMany.mock.calls[0][0].orderBy).toEqual([
      { targetDate: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('crée les jalons de départ dans l’ordre reçu et vérifie les projets', async () => {
    await service.create('user-1', {
      title: 'Lancer DevMirror',
      projectIds: ['p1'],
      milestones: ['API', 'Front'],
    });

    expect(projects.assertAllOwned).toHaveBeenCalledWith('user-1', ['p1']);
    expect(prisma.goal.create.mock.calls[0][0].data).toMatchObject({
      projects: { connect: [{ id: 'p1' }] },
      milestones: {
        create: [
          { title: 'API', position: 0 },
          { title: 'Front', position: 1 },
        ],
      },
    });
  });

  it('remplace les projets liés seulement si projectIds est fourni', async () => {
    await service.update('user-1', 'g1', { title: 'Nouveau titre' });
    expect(prisma.goal.update.mock.calls[0][0].data).not.toHaveProperty('projects');
    expect(projects.assertAllOwned).not.toHaveBeenCalled();

    await service.update('user-1', 'g1', { projectIds: [] });
    expect(prisma.goal.update.mock.calls[1][0].data.projects).toEqual({ set: [] });
  });

  it('refuse un projet étranger sans rien écrire', async () => {
    projects.assertAllOwned.mockRejectedValueOnce(new BadRequestException());

    await expect(
      service.create('user-1', { title: 'X', projectIds: ['p-autre'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });
});

describe('MilestonesService', () => {
  const tx = { milestone: { update: vi.fn() }, activity: { create: vi.fn() } };
  const prisma = {
    goal: { count: vi.fn() },
    milestone: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const service = new MilestonesService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

  it('ajoute le jalon en dernier', async () => {
    prisma.goal.count.mockResolvedValue(1);
    prisma.milestone.count.mockResolvedValue(2);
    prisma.milestone.aggregate.mockResolvedValue({ _max: { position: 4 } });

    await service.create('user-1', 'g1', { title: 'Déployer' });

    expect(prisma.milestone.create.mock.calls[0][0].data).toEqual({
      goalId: 'g1',
      title: 'Déployer',
      position: 5,
    });
  });

  it('renvoie 404 si l’objectif appartient à un autre utilisateur', async () => {
    prisma.goal.count.mockResolvedValue(0);
    await expect(service.create('user-1', 'g-autre', { title: 'X' })).rejects.toThrow(
      GOAL_NOT_FOUND,
    );
  });

  it(`refuse au-delà de ${MAX_MILESTONES_PER_GOAL} jalons`, async () => {
    prisma.goal.count.mockResolvedValue(1);
    prisma.milestone.count.mockResolvedValue(MAX_MILESTONES_PER_GOAL);
    prisma.milestone.aggregate.mockResolvedValue({ _max: { position: 29 } });

    await expect(service.create('user-1', 'g1', { title: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cocher un jalon enregistre une activité, une seule fois', async () => {
    prisma.milestone.findFirst.mockResolvedValueOnce({ done: false });
    await service.update('user-1', 'g1', 'm1', { done: true });
    expect(tx.activity.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'MILESTONE_COMPLETED',
        entityType: 'MILESTONE',
        entityId: 'm1',
      },
    });

    prisma.milestone.findFirst.mockResolvedValueOnce({ done: true });
    await service.update('user-1', 'g1', 'm1', { done: true });
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
  });

  it('vérifie que le jalon appartient à l’objectif et à l’utilisateur', async () => {
    prisma.milestone.findFirst.mockResolvedValue(null);

    await expect(service.update('user-1', 'g1', 'm9', { done: true })).rejects.toThrow(
      new NotFoundException(MILESTONE_NOT_FOUND),
    );
    expect(prisma.milestone.findFirst.mock.calls[0][0].where).toEqual({
      id: 'm9',
      goalId: 'g1',
      goal: { userId: 'user-1' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
