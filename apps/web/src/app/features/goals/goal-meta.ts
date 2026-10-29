import { formatDate } from '../../core/i18n/format';
import { translate } from '../../core/i18n/translate';
import type { Goal, Milestone } from '@devmirror/api-client';

/** Limite fixée par l'API (MAX_MILESTONES_PER_GOAL). */
export const MAX_MILESTONES = 30;

/**
 * Remplace les jalons d'un objectif et recalcule progression et état « atteint », comme le
 * fait l'API : sert aux mises à jour optimistes, avant la réponse du serveur.
 */
export function withMilestones(goal: Goal, milestones: Milestone[]): Goal {
  const total = milestones.length;
  const done = milestones.filter((milestone) => milestone.done).length;
  return {
    ...goal,
    milestones,
    progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
    completed: total > 0 && done === total,
  };
}

export type TargetTone = 'completed' | 'overdue' | 'soon' | 'later';

export interface TargetLabel {
  label: string;
  tone: TargetTone;
}

const DAY = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** « Atteint », « Dépassé · 12 oct. 2026 », « Aujourd’hui », « Dans 5 jours », « 15 déc. 2026 ». */
export function targetLabel(goal: Goal, now: Date = new Date()): TargetLabel | null {
  if (goal.completed) return { label: translate('goals.target.completed'), tone: 'completed' };
  if (!goal.targetDate) return null;

  const target = new Date(goal.targetDate);
  const days = Math.round((startOfDay(target) - startOfDay(now)) / DAY);
  const date = formatDate(target, { day: 'numeric', month: 'short', year: 'numeric' });

  if (days < 0) return { label: translate('goals.target.overdue', { date }), tone: 'overdue' };
  if (days === 0) return { label: translate('tasks.due.today'), tone: 'soon' };
  if (days === 1) return { label: translate('tasks.due.tomorrow'), tone: 'soon' };
  if (days <= 14) return { label: translate('goals.target.inDays', { count: days }), tone: 'soon' };
  return { label: date, tone: 'later' };
}

export const TARGET_TONES: Record<TargetTone, string> = {
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  overdue: 'bg-red-500/15 text-red-700 dark:text-red-300',
  soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  later: 'bg-muted text-muted-foreground',
};
