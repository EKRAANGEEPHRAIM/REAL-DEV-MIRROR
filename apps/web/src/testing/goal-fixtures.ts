import type { Goal, Milestone, Paginated } from '@devmirror/api-client';
import { withMilestones } from '../app/features/goals/goal-meta';

export function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return { id: 'm1', title: 'Mettre à jour le portfolio', done: false, position: 0, ...overrides };
}

/** Progression et état « atteint » recalculés d'après les jalons, comme le fait l'API. */
export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  const goal: Goal = {
    id: 'g1',
    title: 'Décrocher une mission freelance',
    description: null,
    targetDate: null,
    milestones: [],
    projects: [],
    progress: { total: 0, done: 0, percent: 0 },
    completed: false,
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-10-24T09:00:00.000Z',
    ...overrides,
  };
  return withMilestones(goal, goal.milestones);
}

export function goalPage(goals: Goal[], total = goals.length, current = 1): Paginated<Goal> {
  const limit = 12;
  return {
    data: goals,
    meta: { total, page: current, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
