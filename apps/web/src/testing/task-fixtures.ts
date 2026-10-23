import type { Paginated, Task } from '@devmirror/api-client';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Écrire les tests',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    position: 0,
    completedAt: null,
    project: null,
    subtasks: [],
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-22T09:00:00.000Z',
    ...overrides,
  };
}

export function taskPage(
  tasks: Task[],
  total = tasks.length,
  current = 1,
  limit = 25,
): Paginated<Task> {
  return {
    data: tasks,
    meta: { total, page: current, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
