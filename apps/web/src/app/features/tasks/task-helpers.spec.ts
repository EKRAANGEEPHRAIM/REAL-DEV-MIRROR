import { dueLabel, dueQuery, fromDateInput, toDateInput } from './task-dates';
import { taskFiltersFromUrl, taskFiltersToUrl, toTaskQuery } from './task-filters';

// Mercredi 22 octobre 2026, 15 h, heure locale
const now = new Date(2026, 9, 22, 15, 0, 0);

describe('échéances', () => {
  it('« aujourd’hui » et « 7 jours » donnent des bornes locales (début inclus, fin exclue)', () => {
    expect(dueQuery('today', now)).toEqual({
      dueFrom: new Date(2026, 9, 22).toISOString(),
      dueTo: new Date(2026, 9, 23).toISOString(),
    });
    expect(dueQuery('week', now).dueTo).toBe(new Date(2026, 9, 30).toISOString());
    expect(dueQuery('overdue', now)).toEqual({ overdue: true });
    expect(dueQuery('none', now)).toEqual({ noDueDate: true });
    expect(dueQuery(null, now)).toEqual({});
  });

  it('enregistre une date de formulaire en fin de journée locale, et la relit', () => {
    const iso = fromDateInput('2026-10-30')!;

    expect(new Date(iso)).toEqual(new Date(2026, 9, 30, 23, 59, 59, 999));
    expect(toDateInput(iso)).toBe('2026-10-30');
    expect(fromDateInput('')).toBeNull();
  });

  it.each([
    [new Date(2026, 9, 20, 23, 59), false, 'En retard · 20 oct.', 'overdue'],
    [new Date(2026, 9, 22, 23, 59), false, 'Aujourd’hui', 'today'],
    [new Date(2026, 9, 23, 23, 59), false, 'Demain', 'soon'],
    [new Date(2026, 10, 15, 23, 59), false, '15 nov.', 'later'],
    [new Date(2026, 9, 20, 23, 59), true, '20 oct.', 'done'],
  ])('%s (terminée : %s) -> %s', (date, done, label, tone) => {
    expect(dueLabel(date.toISOString(), done, now)).toEqual({ label, tone });
  });

  it('une tâche due aujourd’hui n’est pas en retard avant la fin de la journée', () => {
    const dueToday = fromDateInput('2026-10-22')!;
    expect(dueLabel(dueToday, false, now).tone).toBe('today');
  });
});

describe('filtres de tâches', () => {
  it('lit l’URL en ignorant les valeurs invalides', () => {
    expect(
      taskFiltersFromUrl({ status: 'FINI', priority: 'URGENT', due: 'jamais', sort: 'x' }),
    ).toEqual({
      project: null,
      status: null,
      priority: 'URGENT',
      due: null,
      q: '',
      sort: 'dueDate:asc',
    });
  });

  it('traduit « sans projet » et l’échéance en paramètres de l’API', () => {
    const query = toTaskQuery(taskFiltersFromUrl({ project: 'none', due: 'overdue' }), 2, now);
    expect(query).toEqual({
      page: 2,
      limit: 25,
      sort: 'dueDate:asc',
      withoutProject: true,
      overdue: true,
    });

    expect(toTaskQuery(taskFiltersFromUrl({ project: 'p1' }), 1, now)).toMatchObject({
      projectId: 'p1',
    });
  });

  it('retire de l’URL les valeurs vides et le tri par défaut', () => {
    expect(taskFiltersToUrl({ status: null, sort: 'dueDate:asc', due: 'today' })).toEqual({
      status: null,
      sort: null,
      due: 'today',
    });
  });
});
