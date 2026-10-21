import type { Paginated, Project } from '@devmirror/api-client';

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'DevMirror',
    description: 'Portfolio SaaS',
    status: 'IN_PROGRESS',
    techStack: ['Angular', 'NestJS'],
    repoUrl: null,
    demoUrl: null,
    color: '#6366f1',
    tags: [],
    progress: { total: 4, done: 1, percent: 25 },
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
    ...overrides,
  };
}

export function page(
  projects: Project[],
  total = projects.length,
  current = 1,
  limit = 12,
): Paginated<Project> {
  return {
    data: projects,
    meta: { total, page: current, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
