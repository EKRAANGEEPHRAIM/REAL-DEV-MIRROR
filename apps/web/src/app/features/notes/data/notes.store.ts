import { computed, inject } from '@angular/core';
import type { NoteListQuery, NoteSummary, PaginationMeta } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { NotesApi } from './notes.api';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface NotesState {
  meta: PaginationMeta | null;
  status: LoadStatus;
  error: string | null;
}

/** Notes de la page courante (résumés : extrait, sans le contenu complet). */
export const NotesStore = signalStore(
  { providedIn: 'root' },
  withEntities<NoteSummary>(),
  withState<NotesState>({ meta: null, status: 'idle', error: null }),
  withComputed(({ entities, status, meta }) => ({
    isInitialLoading: computed(() => status() === 'loading' && entities().length === 0),
    isRefreshing: computed(() => status() === 'loading' && entities().length > 0),
    isEmpty: computed(() => status() === 'loaded' && entities().length === 0),
    total: computed(() => meta()?.total ?? 0),
  })),
  withMethods((store, api = inject(NotesApi)) => {
    let lastQuery: NoteListQuery | null = null;

    const load = rxMethod<NoteListQuery>(
      pipe(
        tap((query) => {
          lastQuery = query;
          patchState(store, { status: 'loading', error: null });
        }),
        switchMap((query) =>
          api.list(query).pipe(
            tapResponse({
              next: ({ data, meta }) =>
                patchState(store, setAllEntities(data), { meta, status: 'loaded' }),
              error: (error) =>
                patchState(store, { status: 'error', error: apiErrorMessage(error) }),
            }),
          ),
        ),
      ),
    );

    return {
      load,
      reload: () => {
        if (lastQuery) load(lastQuery);
      },
    };
  }),
);
