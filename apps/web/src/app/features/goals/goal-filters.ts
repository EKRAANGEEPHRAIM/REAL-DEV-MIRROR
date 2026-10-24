import type { GoalListQuery } from '@devmirror/api-client';

export const GOALS_PAGE_SIZE = 12;

export const GOAL_STATES = [
  { value: null, label: 'Tous' },
  { value: 'active', label: 'En cours' },
  { value: 'completed', label: 'Atteints' },
] as const;

export type GoalState = 'active' | 'completed';

export const GOAL_SORTS = [
  { value: 'targetDate:asc', label: 'Date cible' },
  { value: 'updatedAt:desc', label: 'Récemment modifiés' },
  { value: 'createdAt:desc', label: 'Récemment créés' },
  { value: 'title:asc', label: 'Titre (A → Z)' },
] as const;

export type GoalSort = (typeof GOAL_SORTS)[number]['value'];
export const DEFAULT_GOAL_SORT: GoalSort = 'targetDate:asc';

/** Filtres de la liste, tels qu'ils s'écrivent dans l'URL. */
export interface GoalFilters {
  state: GoalState | null;
  q: string;
  sort: GoalSort;
}

export interface GoalUrlParams {
  state?: string;
  q?: string;
  sort?: string;
}

export function filtersFromUrl(params: GoalUrlParams): GoalFilters {
  const sort = GOAL_SORTS.find((option) => option.value === params.sort)?.value;
  return {
    state: params.state === 'active' || params.state === 'completed' ? params.state : null,
    q: params.q?.trim() ?? '',
    sort: sort ?? DEFAULT_GOAL_SORT,
  };
}

/** Valeurs par défaut retirées de l'URL, pour garder des liens courts. */
export function filtersToUrl(change: Partial<GoalFilters>): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  if ('state' in change) params['state'] = change.state ?? null;
  if ('q' in change) params['q'] = change.q || null;
  if ('sort' in change)
    params['sort'] = change.sort === DEFAULT_GOAL_SORT ? null : (change.sort ?? null);
  return params;
}

export function toApiQuery(filters: GoalFilters, page: number): GoalListQuery {
  return {
    page,
    limit: GOALS_PAGE_SIZE,
    sort: filters.sort,
    ...(filters.state && { state: filters.state }),
    ...(filters.q && { q: filters.q }),
  };
}

export function hasActiveFilters(filters: GoalFilters): boolean {
  return !!(filters.state || filters.q);
}
