import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { NotesService } from '../notes/notes.service.js';
import { SearchQueryDto } from './dto/search.dto.js';
import { SearchService, titleScore } from './search.service.js';

describe('titleScore', () => {
  it('classe identique > début > début de mot > présence', () => {
    expect(titleScore('JWT', 'jwt')).toBe(4);
    expect(titleScore('JWT et refresh', 'jwt')).toBe(3);
    expect(titleScore('Tester le refresh-jwt', 'jwt')).toBe(2);
    expect(titleScore('AuthJWTGuard', 'jwt')).toBe(1);
    expect(titleScore('Autre chose', 'jwt')).toBe(0);
  });
});

describe('SearchQueryDto', () => {
  const errors = (plain: object) => validateSync(plainToInstance(SearchQueryDto, plain));

  it('exige 2 caractères utiles et borne la limite', () => {
    expect(errors({ q: ' a ' })).toHaveLength(1);
    expect(errors({ q: 'jwt', limit: '21' })).toHaveLength(1);
    const dto = plainToInstance(SearchQueryDto, { q: '  jwt ' });
    expect(dto).toMatchObject({ q: 'jwt', limit: 5 });
  });
});

describe('SearchService', () => {
  const day = (n: number) => new Date(2026, 9, n);
  const prisma = {
    project: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    note: { findMany: vi.fn() },
  };
  const notes = { search: vi.fn() };
  const service = new SearchService(
    prisma as unknown as PrismaService,
    notes as unknown as NotesService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.project.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    notes.search.mockResolvedValue(new Map());
  });

  it('filtre chaque catégorie par utilisateur', async () => {
    await service.search('user-1', { q: 'jwt', limit: 5 });

    expect(prisma.project.findMany.mock.calls[0][0].where.userId).toBe('user-1');
    expect(prisma.task.findMany.mock.calls[0][0].where.userId).toBe('user-1');
    expect(notes.search).toHaveBeenCalledWith('user-1', 'jwt');
    expect(prisma.note.findMany).not.toHaveBeenCalled();
  });

  it('classe les tâches par pertinence du titre, puis par date, et coupe à limit', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 'a', title: 'Refactor du guard JWT', updatedAt: day(20), project: null },
      { id: 'b', title: 'JWT : rotation', updatedAt: day(10), project: null },
      { id: 'c', title: 'Doc', updatedAt: day(25), project: null }, // trouvé dans la description
      { id: 'd', title: 'JWT : expiration', updatedAt: day(15), project: null },
    ]);

    const { tasks } = await service.search('user-1', { q: 'jwt', limit: 3 });

    expect(tasks.map((t) => t.id)).toEqual(['d', 'b', 'a']);
  });

  it('garde l’ordre de pertinence des notes et renvoie un extrait court', async () => {
    notes.search.mockResolvedValue(
      new Map([
        ['n2', 0.9],
        ['n1', 0.4],
      ]),
    );
    prisma.note.findMany.mockResolvedValue([
      { id: 'n1', title: 'Courses', content: 'Parler du **JWT**', pinned: false },
      { id: 'n2', title: 'JWT', content: '# Rotation\n\n' + 'mot '.repeat(60), pinned: true },
    ]);

    const { notes: hits } = await service.search('user-1', { q: 'jwt', limit: 5 });

    expect(hits.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(hits[1].excerpt).toBe('Parler du JWT');
    expect(hits[0].excerpt.length).toBeLessThanOrEqual(121);
  });
});
