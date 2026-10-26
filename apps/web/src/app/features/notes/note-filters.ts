import type { NoteListQuery } from '@devmirror/api-client';

export const NOTES_PAGE_SIZE = 24;

/**
 * Tri explicite ; sans tri (null), la liste suit l'ordre par défaut de l'API : pertinence
 * pendant une recherche, dernières modifiées sinon. Les épinglées restent toujours en tête.
 */
export const NOTE_SORTS = [
  { value: 'updatedAt:desc', label: 'Récemment modifiées' },
  { value: 'createdAt:desc', label: 'Récemment créées' },
  { value: 'title:asc', label: 'Titre (A → Z)' },
] as const;

export type NoteSort = (typeof NOTE_SORTS)[number]['value'];

export interface NoteFilters {
  q: string;
  /** Nom du tag (comme dans l'URL : ?tag=nestjs). */
  tag: string;
  sort: NoteSort | null;
}

export interface NoteUrlParams {
  q?: string;
  tag?: string;
  sort?: string;
}

export function filtersFromUrl(params: NoteUrlParams): NoteFilters {
  return {
    q: params.q?.trim() ?? '',
    tag: params.tag?.trim().toLowerCase() ?? '',
    sort: NOTE_SORTS.find((option) => option.value === params.sort)?.value ?? null,
  };
}

export function filtersToUrl(change: Partial<NoteFilters>): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  if ('q' in change) params['q'] = change.q || null;
  if ('tag' in change) params['tag'] = change.tag || null;
  if ('sort' in change) params['sort'] = change.sort ?? null;
  return params;
}

export function toApiQuery(filters: NoteFilters, page: number): NoteListQuery {
  return {
    page,
    limit: NOTES_PAGE_SIZE,
    ...(filters.q && { q: filters.q }),
    ...(filters.tag && { tag: filters.tag }),
    ...(filters.sort && { sort: filters.sort }),
  };
}

export function hasActiveFilters(filters: NoteFilters): boolean {
  return !!(filters.q || filters.tag);
}

/** Libellé de l'ordre par défaut, qui change pendant une recherche. */
export function defaultSortLabel(filters: NoteFilters): string {
  return filters.q ? 'Pertinence' : 'Récemment modifiées';
}
