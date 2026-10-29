import type { StatsOverview } from '@devmirror/api-client';
import { translate } from '../../core/i18n/translate';

export type TileTone = 'default' | 'positive' | 'warning';

export interface DashboardTile {
  id: 'projects' | 'tasks' | 'goals' | 'streak';
  label: string;
  value: number;
  /** Unité accordée au nombre (« jour » / « jours »), affichée après la valeur. */
  unit?: string;
  detail: string;
  tone: TileTone;
  icon: string;
  /** Lien vers la liste correspondante ; absent pour la série. */
  link?: { commands: string[]; queryParams?: Record<string, string> };
}

/** « +2 par rapport à la semaine dernière », « 1 de moins… », « Autant que… ». */
export function weekComparison(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) {
    return translate(previous === 0 ? 'dashboard.week.noneEither' : 'dashboard.week.same');
  }
  return diff > 0
    ? translate('dashboard.week.more', { count: diff })
    : translate('dashboard.week.fewer', { count: -diff });
}

/**
 * Les quatre tuiles du haut du tableau de bord, calculées depuis /stats/overview. Les libellés
 * passent par translate : appelée dans un computed, la fonction suit la langue courante.
 */
export function buildTiles(overview: StatsOverview): DashboardTile[] {
  const { indicators, tasksCompletedPerWeek, projectsByStatus } = overview;
  const thisWeek = indicators.tasksCompletedThisWeek;
  const lastWeek = tasksCompletedPerWeek.at(-2)?.count ?? 0;
  const projects = projectsByStatus
    .filter((row) => row.status !== 'ARCHIVED')
    .reduce((sum, row) => sum + row.count, 0);
  const streak = indicators.currentStreak;

  return [
    {
      id: 'projects',
      label: translate('dashboard.tiles.projects'),
      value: indicators.activeProjects,
      detail: projects
        ? translate('dashboard.tiles.projectsDetail', { count: projects })
        : translate('dashboard.tiles.noProjects'),
      tone: 'default',
      icon: 'lucideFolderKanban',
      link: { commands: ['/projects'], queryParams: { status: 'IN_PROGRESS' } },
    },
    {
      id: 'tasks',
      label: translate('dashboard.tiles.tasks'),
      value: thisWeek,
      detail: weekComparison(thisWeek, lastWeek),
      tone: thisWeek > lastWeek ? 'positive' : 'default',
      icon: 'lucideSquareCheckBig',
      link: { commands: ['/tasks'], queryParams: { status: 'DONE' } },
    },
    {
      id: 'goals',
      label: translate('dashboard.tiles.goals'),
      value: indicators.activeGoals,
      detail: indicators.completedGoals
        ? translate('dashboard.tiles.goalsDetail', { count: indicators.completedGoals })
        : translate('dashboard.tiles.noGoals'),
      tone: 'default',
      icon: 'lucideTarget',
      link: { commands: ['/goals'], queryParams: { state: 'active' } },
    },
    {
      id: 'streak',
      label: translate('dashboard.tiles.streak'),
      value: streak,
      unit: translate('dashboard.tiles.days', { count: streak }),
      detail:
        streak === 0
          ? translate('dashboard.tiles.streakStart')
          : translate('dashboard.tiles.record', { count: indicators.longestStreak }),
      tone: streak > 0 && streak >= indicators.longestStreak ? 'positive' : 'default',
      icon: 'lucideFlame',
    },
  ];
}

/** « Bonjour » jusqu'à 18 h, « Bonsoir » ensuite (« Good morning / afternoon / evening » en anglais). */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 18) return translate('dashboard.greeting.evening');
  return translate(hour < 12 ? 'dashboard.greeting.morning' : 'dashboard.greeting.afternoon');
}

/** Prénom pour le message d'accueil : premier mot du nom. */
export function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
