import type { TaskListQuery, TaskPriority, TaskStatus } from '@devmirror/api-client';
import { type DueFilter, dueQuery, isDueFilter } from './task-dates';
import { isTaskPriority, isTaskStatus } from './task-meta';

export const TASKS_PAGE_SIZE = 25;
/** Valeur du filtre projet pour « tâches sans projet ». */
export const NO_PROJECT = 'none';

export const TASK_SORTS = [
  { value: 'dueDate:asc', label: 'tasks.sort.due' },
  { value: 'priority:desc', label: 'tasks.sort.priority' },
  { value: 'createdAt:desc', label: 'tasks.sort.created' },
  { value: 'updatedAt:desc', label: 'tasks.sort.updated' },
  { value: 'title:asc', label: 'tasks.sort.title' },
] as const;

export type TaskSort = (typeof TASK_SORTS)[number]['value'];
export const DEFAULT_TASK_SORT: TaskSort = 'dueDate:asc';

export interface TaskFilters {
  /** Id de projet, NO_PROJECT, ou null pour tous. */
  project: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  due: DueFilter | null;
  q: string;
  sort: TaskSort;
}

export interface TaskUrlParams {
  project?: string;
  status?: string;
  priority?: string;
  due?: string;
  q?: string;
  sort?: string;
  page?: string;
}

export function taskFiltersFromUrl(params: TaskUrlParams): TaskFilters {
  return {
    project: params.project?.trim() || null,
    status: isTaskStatus(params.status) ? params.status : null,
    priority: isTaskPriority(params.priority) ? params.priority : null,
    due: isDueFilter(params.due) ? params.due : null,
    q: params.q?.trim() ?? '',
    sort: TASK_SORTS.find((option) => option.value === params.sort)?.value ?? DEFAULT_TASK_SORT,
  };
}

export function taskFiltersToUrl(change: Partial<TaskFilters>): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  for (const key of ['project', 'status', 'priority', 'due', 'q'] as const) {
    if (key in change) params[key] = change[key] || null;
  }
  if ('sort' in change)
    params['sort'] = change.sort === DEFAULT_TASK_SORT ? null : (change.sort ?? null);
  return params;
}

export function toTaskQuery(
  filters: TaskFilters,
  page: number,
  now: Date = new Date(),
): TaskListQuery {
  return {
    page,
    limit: TASKS_PAGE_SIZE,
    sort: filters.sort,
    ...(filters.project === NO_PROJECT && { withoutProject: true }),
    ...(filters.project && filters.project !== NO_PROJECT && { projectId: filters.project }),
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.q && { q: filters.q }),
    ...dueQuery(filters.due, now),
  };
}

export function hasActiveTaskFilters(filters: TaskFilters): boolean {
  return !!(filters.project || filters.status || filters.priority || filters.due || filters.q);
}
