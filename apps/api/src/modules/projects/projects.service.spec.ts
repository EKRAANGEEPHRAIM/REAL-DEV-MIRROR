import { NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ProjectQueryDto } from './dto/project-query.dto.js';
import type { TagsService } from '../tags/tags.service.js';
import { ProjectsService } from './projects.service.js';

const project = (id: string) => ({
  id,
  userId: 'user-1',
  name: `Projet ${id}`,
  description: null,
  status: ProjectStatus.IN_PROGRESS,
  techStack: ['Angular'],
  repoUrl: null,
  demoUrl: null,
  color: null,
  tags: [],
  createdAt: new Date('2026-10-21T09:00:00Z'),
  updatedAt: new Date('2026-10-21T09:00:00Z'),
});

function query(input: Partial<ProjectQueryDto> = {}): ProjectQueryDto {
  return Object.assign(new ProjectQueryDto(), input);
}

describe('ProjectsService', () => {
  const prisma = {
    $transaction: vi.fn(),
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: { groupBy: vi.fn() },
  };
  const tags = { assertOwned: vi.fn() };
  const service = new ProjectsService(
    prisma as unknown as PrismaService,
    tags as unknown as TagsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    prisma.project.findMany.mockResolvedValue([project('p1'), project('p2')]);
    prisma.project.count.mockResolvedValue(2);
    prisma.task.groupBy.mockResolvedValue([]);
  });

  describe('findAll', () => {
    it('filtre par utilisateur et masque les projets archivés par défaut', async () => {
      await service.findAll('user-1', query());

      const args = prisma.project.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ userId: 'user-1', status: { not: ProjectStatus.ARCHIVED } });
      expect(args.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'asc' }]);
      expect(args).toMatchObject({ skip: 0, take: 20 });
    });

    it('combine statut, recherche, tag, tri et pagination', async () => {
      await service.findAll(
        'user-1',
        query({
          status: ProjectStatus.ARCHIVED,
          q: 'mirror',
          tag: 'angular',
          sort: 'name:asc',
          page: 2,
          limit: 10,
        }),
      );

      const args = prisma.project.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        userId: 'user-1',
        status: ProjectStatus.ARCHIVED,
        OR: [
          { name: { contains: 'mirror', mode: 'insensitive' } },
          { description: { contains: 'mirror', mode: 'insensitive' } },
        ],
        tags: { some: { name: { equals: 'angular', mode: 'insensitive' } } },
      });
      expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
      expect(args).toMatchObject({ skip: 10, take: 10 });
    });

    it('calcule la progression de tous les projets en une seule requête groupée', async () => {
      prisma.task.groupBy.mockResolvedValue([
        { projectId: 'p1', status: TaskStatus.DONE, _count: { _all: 1 } },
        { projectId: 'p1', status: TaskStatus.TODO, _count: { _all: 2 } },
      ]);

      const result = await service.findAll('user-1', query());

      expect(prisma.task.groupBy).toHaveBeenCalledTimes(1);
      expect(result.data[0].progress).toEqual({ total: 3, done: 1, percent: 33 });
      expect(result.data[1].progress).toEqual({ total: 0, done: 0, percent: 0 });
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    });
  });

  it('findOne renvoie 404 pour un projet absent ou appartenant à un autre utilisateur', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'p-autre')).rejects.toThrow(
      new NotFoundException('Projet introuvable'),
    );
    expect(prisma.project.findFirst.mock.calls[0][0].where).toEqual({
      id: 'p-autre',
      userId: 'user-1',
    });
  });

  it('update et remove traduisent P2025 en 404 « Projet introuvable »', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('absent', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });
    prisma.project.update.mockRejectedValue(notFound);
    prisma.project.delete.mockRejectedValue(notFound);

    await expect(service.update('user-1', 'p1', { name: 'X' })).rejects.toThrow(
      'Projet introuvable',
    );
    await expect(service.remove('user-1', 'p1')).rejects.toThrow('Projet introuvable');
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'user-1' } });
  });
});
