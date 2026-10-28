import { lastTwoWeeks, makeOverview } from '../../../testing/stats-fixtures';
import { buildTiles, firstName, greeting, weekComparison } from './dashboard-tiles';

const tile = (overview: ReturnType<typeof makeOverview>, id: string) =>
  buildTiles(overview).find((t) => t.id === id)!;

describe('tuiles du tableau de bord', () => {
  it('projets actifs, sur les projets non archivés, avec lien filtré', () => {
    const projects = tile(makeOverview({ activeProjects: 2 }), 'projects');
    expect(projects).toMatchObject({
      value: 2,
      detail: 'Sur 4 projets non archivés',
      link: { commands: ['/projects'], queryParams: { status: 'IN_PROGRESS' } },
    });
    const none = tile(
      makeOverview({ activeProjects: 0 }, { projectsByStatus: [{ status: 'ARCHIVED', count: 2 }] }),
      'projects',
    );
    expect(none.detail).toBe('Aucun projet pour l’instant');
  });

  it('tâches de la semaine comparées à la semaine précédente', () => {
    const up = tile(
      makeOverview({ tasksCompletedThisWeek: 5 }, { tasksCompletedPerWeek: lastTwoWeeks(3, 5) }),
      'tasks',
    );
    expect(up).toMatchObject({
      value: 5,
      detail: '+2 par rapport à la semaine dernière',
      tone: 'positive',
    });
    expect(weekComparison(1, 4)).toBe('3 de moins que la semaine dernière');
    expect(weekComparison(2, 2)).toBe('Autant que la semaine dernière');
    expect(weekComparison(0, 0)).toBe('Aucune la semaine dernière non plus');
  });

  it('objectifs en cours et atteints', () => {
    expect(tile(makeOverview({ activeGoals: 3, completedGoals: 2 }), 'goals').detail).toBe(
      '2 atteints',
    );
    expect(tile(makeOverview({ completedGoals: 1 }), 'goals').detail).toBe('1 atteint');
  });

  it('série : unité accordée, record, encouragement à zéro', () => {
    const streak = tile(makeOverview({ currentStreak: 4, longestStreak: 9 }), 'streak');
    expect(streak).toMatchObject({ value: 4, unit: 'jours', detail: 'Record : 9 jours' });
    expect(streak.link).toBeUndefined();

    const record = tile(makeOverview({ currentStreak: 1, longestStreak: 1 }), 'streak');
    expect(record).toMatchObject({ unit: 'jour', detail: 'Record : 1 jour', tone: 'positive' });

    expect(tile(makeOverview(), 'streak').detail).toBe(
      'Une action aujourd’hui lance une nouvelle série',
    );
  });

  it('accueil : bonjour / bonsoir et prénom', () => {
    expect(greeting(new Date(2026, 9, 28, 9))).toBe('Bonjour');
    expect(greeting(new Date(2026, 9, 28, 19))).toBe('Bonsoir');
    expect(firstName('  Ada Lovelace ')).toBe('Ada');
    expect(firstName(undefined)).toBe('');
  });
});
