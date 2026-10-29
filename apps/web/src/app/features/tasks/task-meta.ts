import type { TaskPriority, TaskStatus } from '@devmirror/api-client';
import type { TranslationKey } from '../../core/i18n/translate';

export interface Option<T> {
  readonly value: T;
  /** Clé de traduction du libellé (à passer à translate / t()). */
  readonly label: TranslationKey;
  readonly tone: string;
}

export const TASK_STATUSES: readonly Option<TaskStatus>[] = [
  {
    value: 'TODO',
    label: 'tasks.status.TODO',
    tone: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  },
  {
    value: 'IN_PROGRESS',
    label: 'tasks.status.IN_PROGRESS',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    value: 'IN_REVIEW',
    label: 'tasks.status.IN_REVIEW',
    tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  {
    value: 'DONE',
    label: 'tasks.status.DONE',
    tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
];

/** Du plus urgent au moins urgent (ordre d'affichage des listes). */
export const TASK_PRIORITIES: readonly Option<TaskPriority>[] = [
  {
    value: 'URGENT',
    label: 'tasks.priority.URGENT',
    tone: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
  {
    value: 'HIGH',
    label: 'tasks.priority.HIGH',
    tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  {
    value: 'MEDIUM',
    label: 'tasks.priority.MEDIUM',
    tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  {
    value: 'LOW',
    label: 'tasks.priority.LOW',
    tone: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  },
];

export function taskStatus(value: TaskStatus): Option<TaskStatus> {
  return TASK_STATUSES.find((status) => status.value === value) ?? TASK_STATUSES[0];
}

export function taskPriority(value: TaskPriority): Option<TaskPriority> {
  return TASK_PRIORITIES.find((priority) => priority.value === value) ?? TASK_PRIORITIES[2];
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.some((status) => status.value === value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.some((priority) => priority.value === value);
}
