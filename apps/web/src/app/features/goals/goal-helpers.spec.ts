import { makeGoal, makeMilestone } from '../../../testing/goal-fixtures';
import { filtersFromUrl, filtersToUrl, hasActiveFilters, toApiQuery } from './goal-filters';
import { targetLabel, withMilestones } from './goal-meta';

describe('withMilestones', () => {
  it('recalcule la progression et l’état atteint', () => {
    const goal = makeGoal();
    const partial = withMilestones(goal, [
      makeMilestone({ id: 'a', done: true }),
      makeMilestone({ id: 'b' }),
      makeMilestone({ id: 'c' }),
    ]);
    expect(partial.progress).toEqual({ total: 3, done: 1, percent: 33 });
    expect(partial.completed).toBe(false);

    const all = withMilestones(goal, [makeMilestone({ done: true })]);
    expect(all).toMatchObject({ completed: true, progress: { percent: 100 } });
    expect(withMilestones(goal, []).completed).toBe(false);
  });
});

describe('targetLabel', () => {
  const now = new Date(2026, 9, 24, 15, 0);
  const at = (y: number, m: number, d: number) =>
    makeGoal({ targetDate: new Date(y, m, d, 23, 59).toISOString() });

  it('indique l’échéance relative', () => {
    expect(targetLabel(at(2026, 9, 24), now)).toEqual({ label: 'Aujourd’hui', tone: 'soon' });
    expect(targetLabel(at(2026, 9, 25), now)?.label).toBe('Demain');
    expect(targetLabel(at(2026, 9, 29), now)?.label).toBe('Dans 5 jours');
    expect(targetLabel(at(2026, 11, 15), now)).toEqual({ label: '15 déc. 2026', tone: 'later' });
    expect(targetLabel(at(2026, 9, 12), now)).toEqual({
      label: 'Dépassé · 12 oct. 2026',
      tone: 'overdue',
    });
  });

  it('un objectif atteint ou sans date', () => {
    const done = makeGoal({
      targetDate: '2026-01-01T00:00:00.000Z',
      milestones: [makeMilestone({ done: true })],
    });
    expect(targetLabel(done, now)).toEqual({ label: 'Atteint', tone: 'completed' });
    expect(targetLabel(makeGoal(), now)).toBeNull();
  });
});

describe('filtres des objectifs', () => {
  it('lit l’URL en ignorant les valeurs invalides', () => {
    expect(filtersFromUrl({ state: 'completed', q: ' cv ', sort: 'title:asc' })).toEqual({
      state: 'completed',
      q: 'cv',
      sort: 'title:asc',
    });
    expect(filtersFromUrl({ state: 'fini', sort: 'userId:asc' })).toEqual({
      state: null,
      q: '',
      sort: 'targetDate:asc',
    });
  });

  it('retire les valeurs par défaut de l’URL et construit la requête', () => {
    expect(filtersToUrl({ state: null, q: '', sort: 'targetDate:asc' })).toEqual({
      state: null,
      q: null,
      sort: null,
    });
    const filters = filtersFromUrl({ state: 'active', q: 'mission' });
    expect(toApiQuery(filters, 2)).toEqual({
      page: 2,
      limit: 12,
      sort: 'targetDate:asc',
      state: 'active',
      q: 'mission',
    });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveFilters(filtersFromUrl({ sort: 'title:asc' }))).toBe(false);
  });
});
