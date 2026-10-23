import type { TaskPriority, TaskStatus } from '@devmirror/api-client';

export interface Option<T> {
  readonly value: T;
  readonly label: string;
  readonly tone: string;
}

export const TASK_STATUSES: readonly Option<TaskStatus>[] = [
  { value: 'TODO', label: 'À faire', tone: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
  {
    value: 'IN_PROGRESS',
    label: 'En cours',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    value: 'IN_REVIEW',
    label: 'En revue',
    tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  {
    value: 'DONE',
    label: 'Terminée',
    tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
];

/** Du plus urgent au moins urgent (ordre d'affichage des listes). */
export const TASK_PRIORITIES: readonly Option<TaskPriority>[] = [
  { value: 'URGENT', label: 'Urgente', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  { value: 'HIGH', label: 'Haute', tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { value: 'MEDIUM', label: 'Moyenne', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  { value: 'LOW', label: 'Basse', tone: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400' },
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
