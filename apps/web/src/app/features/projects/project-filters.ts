import type { ProjectListQuery, ProjectStatus } from '@devmirror/api-client';
import { isProjectStatus } from './project-status';

export const PROJECTS_PAGE_SIZE = 12;

export const PROJECT_SORTS = [
  { value: 'updatedAt:desc', label: 'Récemment modifiés' },
  { value: 'createdAt:desc', label: 'Récemment créés' },
  { value: 'name:asc', label: 'Nom (A → Z)' },
  { value: 'status:asc', label: 'Statut' },
] as const;

export type ProjectSort = (typeof PROJECT_SORTS)[number]['value'];
export const DEFAULT_PROJECT_SORT: ProjectSort = 'updatedAt:desc';

/** Filtres de la liste, tels qu'ils s'écrivent dans l'URL. */
export interface ProjectFilters {
  status: ProjectStatus | null;
  q: string;
  tag: string;
  sort: ProjectSort;
  archived: boolean;
}

/** Paramètres d'URL bruts (toujours des chaînes, éventuellement absents ou invalides). */
export interface ProjectUrlParams {
  status?: string;
  q?: string;
  tag?: string;
  sort?: string;
  archived?: string;
  page?: string;
}

export function filtersFromUrl(params: ProjectUrlParams): ProjectFilters {
  const sort = PROJECT_SORTS.find((option) => option.value === params.sort)?.value;
  return {
    status: isProjectStatus(params.status) ? params.status : null,
    q: params.q?.trim() ?? '',
    tag: params.tag?.trim() ?? '',
    sort: sort ?? DEFAULT_PROJECT_SORT,
    archived: params.archived === 'true',
  };
}

export function pageFromUrl(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Valeurs par défaut retirées de l'URL, pour garder des liens courts et lisibles. */
export function filtersToUrl(change: Partial<ProjectFilters>): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  if ('status' in change) params['status'] = change.status ?? null;
  if ('q' in change) params['q'] = change.q || null;
  if ('tag' in change) params['tag'] = change.tag || null;
  if ('sort' in change)
    params['sort'] = change.sort === DEFAULT_PROJECT_SORT ? null : (change.sort ?? null);
  if ('archived' in change) params['archived'] = change.archived ? 'true' : null;
  return params;
}

export function toApiQuery(filters: ProjectFilters, page: number): ProjectListQuery {
  return {
    page,
    limit: PROJECTS_PAGE_SIZE,
    sort: filters.sort,
    ...(filters.status && { status: filters.status }),
    ...(filters.q && { q: filters.q }),
    ...(filters.tag && { tag: filters.tag }),
    ...(filters.archived && { includeArchived: true }),
  };
}

export function hasActiveFilters(filters: ProjectFilters): boolean {
  return !!(filters.status || filters.q || filters.tag || filters.archived);
}
