import {
  defaultSortLabel,
  filtersFromUrl,
  filtersToUrl,
  hasActiveFilters,
  toApiQuery,
} from './note-filters';

describe('filtres des notes', () => {
  it('lit l’URL : tag en minuscules, tri inconnu ignoré', () => {
    expect(filtersFromUrl({ q: ' jwt ', tag: 'NestJS', sort: 'content:asc' })).toEqual({
      q: 'jwt',
      tag: 'nestjs',
      sort: null,
    });
  });

  it('sans tri explicite : pertinence en recherche, dernières modifiées sinon', () => {
    const search = filtersFromUrl({ q: 'jwt' });
    expect(toApiQuery(search, 1)).toEqual({ page: 1, limit: 24, q: 'jwt' });
    expect(defaultSortLabel(search)).toBe('Pertinence');
    expect(defaultSortLabel(filtersFromUrl({}))).toBe('Récemment modifiées');

    const sorted = filtersFromUrl({ q: 'jwt', sort: 'title:asc', tag: 'nestjs' });
    expect(toApiQuery(sorted, 3)).toEqual({
      page: 3,
      limit: 24,
      q: 'jwt',
      tag: 'nestjs',
      sort: 'title:asc',
    });
  });

  it('écrit l’URL sans valeurs vides ; le tri n’est pas un filtre', () => {
    expect(filtersToUrl({ q: '', tag: 'nestjs', sort: null })).toEqual({
      q: null,
      tag: 'nestjs',
      sort: null,
    });
    expect(hasActiveFilters(filtersFromUrl({ sort: 'title:asc' }))).toBe(false);
    expect(hasActiveFilters(filtersFromUrl({ tag: 'nestjs' }))).toBe(true);
  });
});
