import { relativeTime } from '../../shared/format/relative-time';
import {
  filtersFromUrl,
  filtersToUrl,
  hasActiveFilters,
  pageFromUrl,
  toApiQuery,
} from './project-filters';

describe('filtres de projets', () => {
  it('lit l’URL en ignorant les valeurs invalides', () => {
    expect(
      filtersFromUrl({ status: 'PIRATE', sort: 'passwordHash:asc', q: '  api ', archived: 'oui' }),
    ).toEqual({ status: null, q: 'api', tag: '', sort: 'updatedAt:desc', archived: false });
  });

  it('écrit des URL courtes : valeurs par défaut et vides retirées', () => {
    expect(filtersToUrl({ status: null, q: '', sort: 'updatedAt:desc', archived: false })).toEqual({
      status: null,
      q: null,
      sort: null,
      archived: null,
    });
    expect(filtersToUrl({ status: 'DONE', sort: 'name:asc', archived: true })).toEqual({
      status: 'DONE',
      sort: 'name:asc',
      archived: 'true',
    });
  });

  it('construit la requête de l’API sans les filtres vides', () => {
    const filters = filtersFromUrl({ q: 'api', archived: 'true' });

    expect(toApiQuery(filters, 2)).toEqual({
      page: 2,
      limit: 12,
      sort: 'updatedAt:desc',
      q: 'api',
      includeArchived: true,
    });
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveFilters(filtersFromUrl({}))).toBe(false);
  });

  it.each([
    [undefined, 1],
    ['3', 3],
    ['0', 1],
    ['-2', 1],
    ['abc', 1],
    ['1.5', 1],
  ])('page %s -> %i', (value, expected) => {
    expect(pageFromUrl(value)).toBe(expected);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it.each([
    ['2026-10-21T11:59:30Z', 'à l’instant'],
    ['2026-10-21T09:00:00Z', 'il y a 3 heures'],
    ['2026-10-20T12:00:00Z', 'hier'],
    ['2026-10-01T12:00:00Z', 'il y a 3 semaines'],
  ])('%s -> %s', (date, expected) => {
    expect(relativeTime(date, now)).toBe(expected);
  });
});
