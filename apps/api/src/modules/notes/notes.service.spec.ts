import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { TagsService } from '../tags/tags.service.js';
import { noteExcerpt } from './note-excerpt.js';
import { NotesService } from './notes.service.js';

describe('noteExcerpt', () => {
  it('retire la syntaxe Markdown et les blocs de code', () => {
    const markdown = [
      '# Rotation des **refresh tokens**',
      '',
      '> Un jeton ne sert qu’une fois.',
      '',
      '```ts',
      'const secret = process.env.JWT_SECRET;',
      '```',
      '- Voir [la RFC](https://datatracker.ietf.org) et `reuse detection`',
      '![schéma](schema.png)',
    ].join('\n');

    expect(noteExcerpt(markdown)).toBe(
      'Rotation des refresh tokens Un jeton ne sert qu’une fois. Voir la RFC et reuse detection',
    );
  });

  it('coupe sur un mot et ajoute des points de suspension', () => {
    const excerpt = noteExcerpt('mot '.repeat(100), 30);
    expect(excerpt).toBe('mot mot mot mot mot mot mot…');
    expect(noteExcerpt('')).toBe('');
  });
});

describe('NotesService', () => {
  const tx = { note: { create: vi.fn() }, activity: { create: vi.fn() } };
  const prisma = {
    note: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as []),
    ),
  };
  const projects = { assertOwned: vi.fn() };
  const tags = { assertOwned: vi.fn() };
  const service = new NotesService(
    prisma as unknown as PrismaService,
    projects as unknown as ProjectsService,
    tags as unknown as TagsService,
  );

  const note = (id: string, pinned = false) => ({
    id,
    title: id,
    content: `contenu ${id}`,
    pinned,
    project: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.note.findMany.mockResolvedValue([]);
    prisma.note.count.mockResolvedValue(0);
  });

  it('liste : épinglées en tête, puis le tri demandé', async () => {
    await service.findAll('user-1', { page: 1, limit: 20, sort: 'title:asc', pinned: false });

    expect(prisma.note.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 'user-1', pinned: false },
      orderBy: [{ pinned: 'desc' }, { title: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('recherche : classe par pertinence, épinglées d’abord, et pagine', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'a', rank: 0.9 },
      { id: 'b', rank: 0.5 },
      { id: 'c', rank: 0.1 },
    ]);
    // Filtres Prisma appliqués : les trois correspondent, c est épinglée
    prisma.note.findMany
      .mockResolvedValueOnce([
        { id: 'a', pinned: false },
        { id: 'b', pinned: false },
        { id: 'c', pinned: true },
      ])
      .mockResolvedValueOnce([note('a'), note('c', true)]);

    const result = await service.findAll('user-1', { page: 1, limit: 2, q: 'jwt' });

    expect(prisma.note.findMany.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      id: { in: ['a', 'b', 'c'] },
    });
    expect(result.data.map((n) => n.id)).toEqual(['c', 'a']);
    expect(result.meta).toMatchObject({ total: 3, totalPages: 2 });
    expect(result.data[0]).not.toHaveProperty('content');
    expect(result.data[0].excerpt).toBe('contenu c');
  });

  it('recherche avec un tri explicite : l’ordre demandé remplace la pertinence', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'a', rank: 1 }]);

    await service.findAll('user-1', { page: 1, limit: 20, q: 'jwt', sort: 'createdAt:desc' });

    expect(prisma.note.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 'user-1', id: { in: ['a'] } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('création : vérifie projet et tags, enregistre l’activité', async () => {
    tx.note.create.mockResolvedValue(note('n1'));

    await service.create('user-1', { title: 'JWT', projectId: 'p1', tagIds: ['t1'] });

    expect(projects.assertOwned).toHaveBeenCalledWith('user-1', 'p1');
    expect(tags.assertOwned).toHaveBeenCalledWith('user-1', ['t1']);
    expect(tx.note.create.mock.calls[0][0].data).toMatchObject({
      content: '',
      projectId: 'p1',
      tags: { connect: [{ id: 't1' }] },
    });
    expect(tx.activity.create.mock.calls[0][0].data).toMatchObject({ type: 'NOTE_CREATED' });
  });

  it('refuse un tag étranger sans rien écrire', async () => {
    tags.assertOwned.mockRejectedValueOnce(new BadRequestException());

    await expect(
      service.create('user-1', { title: 'X', tagIds: ['autre'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('modification : épingler sans toucher aux tags ; projectId null détache', async () => {
    prisma.note.update.mockResolvedValue(note('n1', true));

    await service.update('user-1', 'n1', { pinned: true, projectId: null });

    const data = prisma.note.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ pinned: true, projectId: null });
    expect(data).not.toHaveProperty('tags');
    expect(projects.assertOwned).not.toHaveBeenCalled();
  });
});
