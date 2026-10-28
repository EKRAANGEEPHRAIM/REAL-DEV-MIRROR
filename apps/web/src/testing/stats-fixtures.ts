import type { StatsIndicators, StatsOverview } from '@devmirror/api-client';

/** Réponse de /stats/overview ; `indicators` et le reste se surchargent séparément. */
export function makeOverview(
  indicators: Partial<StatsIndicators> = {},
  overrides: Partial<StatsOverview> = {},
): StatsOverview {
  const weeks = Array.from({ length: 12 }, (_, i) => ({
    weekStart: new Date(Date.UTC(2026, 7, 10 + 7 * i)).toISOString().slice(0, 10),
    count: 0,
  }));
  return {
    timeZone: 'Europe/Paris',
    today: '2026-10-28',
    indicators: {
      activeProjects: 2,
      openTasks: 8,
      tasksCompletedThisWeek: 0,
      overdueTasks: 0,
      activeGoals: 1,
      completedGoals: 0,
      notes: 4,
      currentStreak: 0,
      longestStreak: 0,
      ...indicators,
    },
    tasksCompletedPerWeek: weeks,
    projectsByStatus: [
      { status: 'IDEA', count: 1 },
      { status: 'IN_PROGRESS', count: 2 },
      { status: 'PAUSED', count: 0 },
      { status: 'DONE', count: 1 },
      { status: 'ARCHIVED', count: 3 },
    ],
    dueSoon: [],
    recentNotes: [],
    activity: { from: '2025-10-27', to: '2026-10-28', total: 0, days: [] },
    ...overrides,
  };
}

/** Semaines dont seules les deux dernières (précédente, courante) sont renseignées. */
export function lastTwoWeeks(
  previous: number,
  current: number,
): StatsOverview['tasksCompletedPerWeek'] {
  const weeks = makeOverview().tasksCompletedPerWeek;
  weeks[10] = { ...weeks[10], count: previous };
  weeks[11] = { ...weeks[11], count: current };
  return weeks;
}
