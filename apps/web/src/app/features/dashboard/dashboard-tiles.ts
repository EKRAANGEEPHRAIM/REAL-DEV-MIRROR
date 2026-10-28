import type { StatsOverview } from '@devmirror/api-client';

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

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular;
}

/** « +2 par rapport à la semaine dernière », « 1 de moins… », « Autant que… ». */
export function weekComparison(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0)
    return previous === 0
      ? 'Aucune la semaine dernière non plus'
      : 'Autant que la semaine dernière';
  return diff > 0
    ? `+${diff} par rapport à la semaine dernière`
    : `${-diff} de moins que la semaine dernière`;
}

/** Les quatre tuiles du haut du tableau de bord, calculées depuis /stats/overview. */
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
      label: 'Projets actifs',
      value: indicators.activeProjects,
      detail: projects
        ? `Sur ${projects} ${plural(projects, 'projet')} non archivé${projects > 1 ? 's' : ''}`
        : 'Aucun projet pour l’instant',
      tone: 'default',
      icon: 'lucideFolderKanban',
      link: { commands: ['/projects'], queryParams: { status: 'IN_PROGRESS' } },
    },
    {
      id: 'tasks',
      label: 'Tâches terminées cette semaine',
      value: thisWeek,
      detail: weekComparison(thisWeek, lastWeek),
      tone: thisWeek > lastWeek ? 'positive' : 'default',
      icon: 'lucideSquareCheckBig',
      link: { commands: ['/tasks'], queryParams: { status: 'DONE' } },
    },
    {
      id: 'goals',
      label: 'Objectifs en cours',
      value: indicators.activeGoals,
      detail: indicators.completedGoals
        ? `${indicators.completedGoals} ${plural(indicators.completedGoals, 'atteint')}`
        : 'Aucun objectif atteint pour l’instant',
      tone: 'default',
      icon: 'lucideTarget',
      link: { commands: ['/goals'], queryParams: { state: 'active' } },
    },
    {
      id: 'streak',
      label: 'Série de jours actifs',
      value: streak,
      unit: plural(streak, 'jour'),
      detail:
        streak === 0
          ? 'Une action aujourd’hui lance une nouvelle série'
          : `Record : ${indicators.longestStreak} ${plural(indicators.longestStreak, 'jour')}`,
      tone: streak > 0 && streak >= indicators.longestStreak ? 'positive' : 'default',
      icon: 'lucideFlame',
    },
  ];
}

/** « Bonjour » jusqu'à 18 h, « Bonsoir » ensuite. */
export function greeting(now: Date = new Date()): string {
  return now.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
}

/** Prénom pour le message d'accueil : premier mot du nom. */
export function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
