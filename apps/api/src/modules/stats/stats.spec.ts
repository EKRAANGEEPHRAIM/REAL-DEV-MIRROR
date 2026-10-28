import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProjectStatus } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { StatsQueryDto } from './dto/stats.dto.js';
import {
  activityStart,
  addDays,
  fillWeeks,
  isTimeZone,
  localDate,
  startOfWeek,
  streaks,
  weekStarts,
} from './stats-calendar.js';
import { fillStatuses, StatsService } from './stats.service.js';

describe('calendrier des statistiques', () => {
  it('donne la date locale selon le fuseau', () => {
    // 23 h 30 UTC le 31 décembre : déjà le 1er janvier à Paris, encore le 31 à New York
    const instant = new Date('2026-12-31T23:30:00Z');
    expect(localDate(instant, 'Europe/Paris')).toBe('2027-01-01');
    expect(localDate(instant, 'America/New_York')).toBe('2026-12-31');
    expect(localDate(instant, 'UTC')).toBe('2026-12-31');
  });

  it('reconnaît les fuseaux IANA', () => {
    expect(isTimeZone('Europe/Paris')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });

  it('calcule les jours et le lundi de la semaine, y compris à cheval sur deux années', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(startOfWeek('2026-10-28')).toBe('2026-10-26'); // mercredi -> lundi
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // dimanche -> lundi précédent
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('liste 12 lundis consécutifs jusqu’à la semaine courante', () => {
    const weeks = weekStarts('2026-10-28', 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toBe('2026-08-10');
    expect(weeks.at(-1)).toBe('2026-10-26');
    expect(new Set(weeks.map((week) => new Date(`${week}T00:00:00Z`).getUTCDay()))).toEqual(
      new Set([1]),
    );
  });

  it('complète les semaines vides avec 0 et ignore celles hors période', () => {
    const weeks = ['2026-10-12', '2026-10-19', '2026-10-26'];
    expect(
      fillWeeks(weeks, [
        { week: '2026-10-26', count: 4 },
        { week: '2026-10-12', count: 1 },
        { week: '2026-01-05', count: 9 },
      ]),
    ).toEqual([
      { weekStart: '2026-10-12', count: 1 },
      { weekStart: '2026-10-19', count: 0 },
      { weekStart: '2026-10-26', count: 4 },
    ]);
  });

  it('commence la heatmap un lundi, 52 semaines avant la semaine courante', () => {
    const start = activityStart('2026-10-28');
    expect(start).toBe('2025-10-27');
    expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});

describe('séries de jours actifs', () => {
  const days = (...list: string[]) => new Set(list);

  it('compte la série jusqu’à aujourd’hui', () => {
    expect(streaks(days('2026-10-26', '2026-10-27', '2026-10-28'), '2026-10-28')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('garde la série d’hier tant qu’aujourd’hui n’est pas fini', () => {
    expect(streaks(days('2026-10-26', '2026-10-27'), '2026-10-28').current).toBe(2);
  });

  it('remet à zéro après un jour sans activité ; garde la plus longue série', () => {
    const active = days(
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04', // 4 jours
      '2026-10-20',
      '2026-10-21', // 2 jours, finis avant-hier
    );
    expect(streaks(active, '2026-10-28')).toEqual({ current: 0, longest: 4 });
    expect(streaks(days(), '2026-10-28')).toEqual({ current: 0, longest: 0 });
  });

  it('traverse le changement de mois et d’année', () => {
    expect(streaks(days('2026-12-31', '2027-01-01'), '2027-01-01').current).toBe(2);
  });
});

describe('projets par statut', () => {
  it('renvoie tous les statuts dans l’ordre, même à 0', () => {
    expect(
      fillStatuses([
        { status: ProjectStatus.DONE, _count: { _all: 2 } },
        { status: ProjectStatus.IDEA, _count: { _all: 1 } },
      ]),
    ).toEqual([
      { status: 'IDEA', count: 1 },
      { status: 'IN_PROGRESS', count: 0 },
      { status: 'PAUSED', count: 0 },
      { status: 'DONE', count: 2 },
      { status: 'ARCHIVED', count: 0 },
    ]);
  });
});

describe('StatsQueryDto', () => {
  it('UTC par défaut ; refuse un fuseau inconnu', () => {
    expect(plainToInstance(StatsQueryDto, {}).tz).toBe('UTC');
    expect(validateSync(plainToInstance(StatsQueryDto, { tz: 'Europe/Paris' }))).toHaveLength(0);
    expect(validateSync(plainToInstance(StatsQueryDto, { tz: 'Paris' }))).toHaveLength(1);
  });
});

describe('StatsService.overview', () => {
  const count = vi.fn();
  const prisma = {
    $queryRaw: vi.fn(),
    project: { groupBy: vi.fn(), count },
    task: { count, findMany: vi.fn() },
    goal: { count },
    note: { count, findMany: vi.fn() },
  };
  const service = new StatsService(prisma as unknown as PrismaService);
  // mercredi 28 octobre 2026, 10 h à Paris
  const now = new Date('2026-10-28T09:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    count.mockResolvedValue(0);
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.note.findMany.mockResolvedValue([
      {
        id: 'n1',
        title: 'JWT',
        content: '# Rotation **une fois**',
        pinned: false,
        updatedAt: now,
      },
    ]);
  });

  it('assemble indicateurs, semaines, série et notes récentes', async () => {
    prisma.$queryRaw
      // tâches terminées par semaine
      .mockResolvedValueOnce([
        { week: '2026-10-26', count: 3 },
        { week: '2026-10-19', count: 1 },
      ])
      // activité par jour
      .mockResolvedValueOnce([
        { date: '2026-10-26', count: 2 },
        { date: '2026-10-27', count: 5 },
      ]);

    const overview = await service.overview('user-1', 'Europe/Paris', now);

    expect(overview.today).toBe('2026-10-28');
    expect(overview.tasksCompletedPerWeek).toHaveLength(12);
    expect(overview.tasksCompletedPerWeek.at(-2)).toEqual({ weekStart: '2026-10-19', count: 1 });
    expect(overview.indicators).toMatchObject({
      tasksCompletedThisWeek: 3,
      currentStreak: 2,
      longestStreak: 2,
    });
    expect(overview.activity).toMatchObject({ from: '2025-10-27', to: '2026-10-28', total: 7 });
    expect(overview.projectsByStatus).toHaveLength(5);
    expect(overview.recentNotes[0].excerpt).toBe('Rotation une fois');
  });

  it('échéances : non terminées, entre maintenant et dans 7 jours', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.overview('user-1', 'UTC', now);

    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'user-1', status: { not: 'DONE' } });
    expect(where.dueDate.gte).toEqual(now);
    expect(where.dueDate.lt).toEqual(new Date('2026-11-04T09:00:00Z'));
  });
});
