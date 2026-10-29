import { formatDate } from '../../core/i18n/format';
import { type TranslationKey, translate } from '../../core/i18n/translate';

/** Échéances : toutes les bornes sont calculées dans le fuseau du navigateur. */

export type DueFilter = 'overdue' | 'today' | 'week' | 'none';

export const DUE_FILTERS: readonly { value: DueFilter; label: TranslationKey }[] = [
  { value: 'overdue', label: 'tasks.due.overdue' },
  { value: 'today', label: 'tasks.due.today' },
  { value: 'week', label: 'tasks.due.week' },
  { value: 'none', label: 'tasks.due.none' },
];

export function isDueFilter(value: unknown): value is DueFilter {
  return DUE_FILTERS.some((filter) => filter.value === value);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export interface DueQuery {
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  noDueDate?: boolean;
}

/** Raccourci d'échéance -> paramètres de l'API (dueFrom inclus, dueTo exclu). */
export function dueQuery(filter: DueFilter | null, now: Date = new Date()): DueQuery {
  const today = startOfDay(now);
  switch (filter) {
    case 'overdue':
      return { overdue: true };
    case 'today':
      return { dueFrom: today.toISOString(), dueTo: addDays(today, 1).toISOString() };
    case 'week':
      return { dueFrom: today.toISOString(), dueTo: addDays(today, 8).toISOString() };
    case 'none':
      return { noDueDate: true };
    default:
      return {};
  }
}

/**
 * Valeur d'un <input type="date"> (AAAA-MM-JJ) -> fin de journée locale en ISO : une tâche
 * « due le 30 » ne passe en retard qu'une fois le 30 terminé.
 */
export function fromDateInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/** ISO -> valeur d'un <input type="date">, dans le fuseau local. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'done';

/** Classes de texte par teinte d'échéance (liste des tâches, tableau de bord). */
export const DUE_TONES: Record<DueTone, string> = {
  overdue: 'text-destructive font-medium',
  today: 'text-amber-600 dark:text-amber-400 font-medium',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
  done: 'text-muted-foreground',
};

export interface DueLabel {
  label: string;
  tone: DueTone;
}

/** « En retard · 12 oct. », « Aujourd’hui », « Demain », « 30 oct. »… */
export function dueLabel(iso: string, done: boolean, now: Date = new Date()): DueLabel {
  const due = new Date(iso);
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const date = formatDate(due, { day: 'numeric', month: 'short' });

  if (done) return { label: date, tone: 'done' };
  if (due < now) return { label: translate('tasks.due.overdueOn', { date }), tone: 'overdue' };
  if (days === 0) return { label: translate('tasks.due.today'), tone: 'today' };
  if (days === 1) return { label: translate('tasks.due.tomorrow'), tone: 'soon' };
  if (days <= 7) return { label: date, tone: 'soon' };
  return { label: date, tone: 'later' };
}
