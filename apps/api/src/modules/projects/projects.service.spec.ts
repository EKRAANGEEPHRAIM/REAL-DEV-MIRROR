import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, ProjectStatus, TaskStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ProjectQueryDto } from './dto/project-query.dto.js';
import type { TagsService } from '../tags/tags.service.js';
import { editableProjects, visibleProjects } from './project-access.js';
import { OWNER_ONLY, READ_ONLY_PROJECT, ProjectsService } from './projects.service.js';

const project = (id: string, members: { role: ProjectRole }[] = [], ownerId = 'user-1') => ({
  id,
  userId: ownerId,
  name: `Projet ${id}`,
  description: null,
  status: ProjectStatus.IN_PROGRESS,
  techStack: ['Angular'],
  repoUrl: null,
  demoUrl: null,
  color: null,
  tags: [],
  user: { id: ownerId, name: 'Ada', avatarUrl: null },
  members,
  _count: { members: members.length },
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

  /** Prochain contrôle de rôle (roleFor) : propriétaire, membre avec ce rôle, ou invisible. */
  function roleCheck(role: 'OWNER' | ProjectRole | null) {
    if (role === null) prisma.project.findFirst.mockResolvedValueOnce(null);
    else if (role === 'OWNER')
      prisma.project.findFirst.mockResolvedValueOnce({ userId: 'user-1', members: [] });
    else prisma.project.findFirst.mockResolvedValueOnce({ userId: 'user-9', members: [{ role }] });
  }

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
    it('liste ses projets et ceux partagés avec lui, sans les archivés par défaut', async () => {
      await service.findAll('user-1', query());

      const args = prisma.project.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        AND: [visibleProjects('user-1'), { status: { not: ProjectStatus.ARCHIVED } }],
      });
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
        AND: [
          visibleProjects('user-1'),
          { status: ProjectStatus.ARCHIVED },
          {
            OR: [
              { name: { contains: 'mirror', mode: 'insensitive' } },
              { description: { contains: 'mirror', mode: 'insensitive' } },
            ],
          },
          { tags: { some: { name: { equals: 'angular', mode: 'insensitive' } } } },
        ],
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

    it('indique le rôle de l’utilisateur et le propriétaire sur chaque projet', async () => {
      prisma.project.findMany.mockResolvedValue([
        project('p1'),
        project('p2', [{ role: ProjectRole.VIEWER }], 'user-9'),
      ]);

      const result = await service.findAll('user-1', query());

      expect(result.data[0]).toMatchObject({ role: 'OWNER', memberCount: 0 });
      expect(result.data[1]).toMatchObject({
        role: ProjectRole.VIEWER,
        owner: { id: 'user-9' },
        memberCount: 1,
      });
    });
  });

  it('findOne renvoie 404 pour un projet absent ou dont il ne fait pas partie', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'p-autre')).rejects.toThrow(
      new NotFoundException('Projet introuvable'),
    );
    expect(prisma.project.findFirst.mock.calls[0][0].where).toEqual({
      AND: [{ id: 'p-autre' }, visibleProjects('user-1')],
    });
  });

  it('findOne renvoie le projet avec sa progression', async () => {
    prisma.project.findFirst.mockResolvedValue(project('p1'));
    prisma.task.groupBy.mockResolvedValue([
      { projectId: 'p1', status: TaskStatus.DONE, _count: { _all: 3 } },
      { projectId: null, status: TaskStatus.DONE, _count: { _all: 5 } },
    ]);

    await expect(service.findOne('user-1', 'p1')).resolves.toMatchObject({
      id: 'p1',
      role: 'OWNER',
      progress: { total: 3, done: 3, percent: 100 },
    });
  });

  describe('create', () => {
    const tx = { project: { create: vi.fn() }, activity: { create: vi.fn() } };

    beforeEach(() => {
      prisma.$transaction.mockImplementation((work: (client: typeof tx) => unknown) => work(tx));
      tx.project.create.mockResolvedValue(project('p3'));
    });

    it('vérifie les tags, crée le projet et journalise l’activité dans la même transaction', async () => {
      const created = await service.create('user-1', {
        name: 'Nouveau',
        techStack: ['NestJS'],
        tagIds: ['t1', 't2'],
      });

      expect(tags.assertOwned).toHaveBeenCalledWith('user-1', ['t1', 't2']);
      expect(tx.project.create.mock.calls[0][0].data).toMatchObject({
        name: 'Nouveau',
        techStack: ['NestJS'],
        userId: 'user-1',
        tags: { connect: [{ id: 't1' }, { id: 't2' }] },
      });
      expect(tx.activity.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', type: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: 'p3' },
      });
      expect(created).toMatchObject({ role: 'OWNER', progress: { total: 0, done: 0, percent: 0 } });
    });

    it('sans tag : rien à connecter', async () => {
      await service.create('user-1', { name: 'Seul' });

      expect(tags.assertOwned).toHaveBeenCalledWith('user-1', []);
      expect(tx.project.create.mock.calls[0][0].data).not.toHaveProperty('tags');
    });

    it('un tag d’un autre utilisateur bloque la création', async () => {
      tags.assertOwned.mockRejectedValueOnce(new Error('Tag introuvable'));

      await expect(service.create('user-1', { name: 'X', tagIds: ['t9'] })).rejects.toThrow(
        'Tag introuvable',
      );
      expect(tx.project.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => prisma.project.update.mockResolvedValue(project('p1')));

    it('le propriétaire remplace la liste des tags seulement quand elle est fournie', async () => {
      roleCheck('OWNER');
      await service.update('user-1', 'p1', { tagIds: ['t1'] });
      roleCheck('OWNER');
      await service.update('user-1', 'p1', { status: ProjectStatus.DONE });

      expect(tags.assertOwned).toHaveBeenCalledTimes(1);
      expect(prisma.project.update.mock.calls[0][0]).toMatchObject({
        where: { id: 'p1' },
        data: { tags: { set: [{ id: 't1' }] } },
      });
      expect(prisma.project.update.mock.calls[1][0].data).not.toHaveProperty('tags');
      expect(prisma.project.update.mock.calls[1][0].data.status).toBe(ProjectStatus.DONE);
    });

    it('un éditeur modifie le projet, mais pas ses étiquettes (personnelles au propriétaire)', async () => {
      roleCheck(ProjectRole.EDITOR);
      await expect(service.update('user-1', 'p1', { name: 'Renommé' })).resolves.toBeDefined();

      roleCheck(ProjectRole.EDITOR);
      await expect(service.update('user-1', 'p1', { tagIds: ['t1'] })).rejects.toThrow(
        new ForbiddenException(OWNER_ONLY),
      );
      expect(prisma.project.update).toHaveBeenCalledTimes(1);
    });

    it('un lecteur ne modifie rien (403), un inconnu ne voit rien (404)', async () => {
      roleCheck(ProjectRole.VIEWER);
      await expect(service.update('user-1', 'p1', { name: 'X' })).rejects.toThrow(
        new ForbiddenException(READ_ONLY_PROJECT),
      );
      roleCheck(null);
      await expect(service.update('user-1', 'p1', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('seul le propriétaire supprime le projet', async () => {
      roleCheck('OWNER');
      await service.remove('user-1', 'p1');
      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('un éditeur reçoit 403, un inconnu 404, et rien n’est supprimé', async () => {
      roleCheck(ProjectRole.EDITOR);
      await expect(service.remove('user-1', 'p1')).rejects.toThrow(
        new ForbiddenException(OWNER_ONLY),
      );
      roleCheck(null);
      await expect(service.remove('user-1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });

    it('laisse passer les erreurs de la base (pas de faux 404)', async () => {
      const outage = new Error('connexion perdue');
      roleCheck('OWNER');
      prisma.project.delete.mockRejectedValue(outage);

      await expect(service.remove('user-1', 'p1')).rejects.toBe(outage);
    });
  });

  describe('contrôles utilisés par les tâches, notes et objectifs', () => {
    it('assertCanEdit : il faut être propriétaire ou éditeur (400 sinon)', async () => {
      prisma.project.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(service.assertCanEdit('user-1', 'p1')).resolves.toBeUndefined();
      await expect(service.assertCanEdit('user-1', 'p9')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.project.count).toHaveBeenLastCalledWith({
        where: { AND: [{ id: 'p9' }, editableProjects('user-1')] },
      });
    });

    it('assertVisible : un lecteur peut y rattacher une note personnelle', async () => {
      prisma.project.count.mockResolvedValueOnce(1);

      await expect(service.assertVisible('user-1', 'p1')).resolves.toBeUndefined();
      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { AND: [{ id: 'p1' }, visibleProjects('user-1')] },
      });
    });

    it('assertAllVisible : tout ou rien, doublons comptés une fois, liste vide sans requête', async () => {
      await service.assertAllVisible('user-1', []);
      expect(prisma.project.count).not.toHaveBeenCalled();

      prisma.project.count.mockResolvedValueOnce(2);
      await expect(service.assertAllVisible('user-1', ['p1', 'p2', 'p1'])).resolves.toBeUndefined();

      prisma.project.count.mockResolvedValueOnce(1);
      await expect(service.assertAllVisible('user-1', ['p1', 'p9'])).rejects.toThrow(
        'Un ou plusieurs projets sont introuvables',
      );
    });
  });
});
