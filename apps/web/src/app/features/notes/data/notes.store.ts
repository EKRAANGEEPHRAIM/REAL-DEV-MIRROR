import { computed, inject } from '@angular/core';
import type { NoteListQuery, NoteSummary, PaginationMeta } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { mergeMap, pipe, switchMap, tap } from 'rxjs';
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
    /** L'API renvoie les épinglées en tête : la page se découpe en deux sections. */
    pinned: computed(() => entities().filter((note) => note.pinned)),
    others: computed(() => entities().filter((note) => !note.pinned)),
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

    const reload = () => {
      if (lastQuery) load(lastQuery);
    };

    return {
      load,
      reload,

      /**
       * Épingle / désépingle depuis la liste : l'icône change tout de suite, puis la page est
       * relue pour que la note rejoigne sa place (épinglées en tête). Annulé si l'API refuse.
       */
      togglePin: rxMethod<NoteSummary>(
        pipe(
          mergeMap((note) => {
            const pinned = !note.pinned;
            patchState(store, updateEntity({ id: note.id, changes: { pinned } }));
            return api.update(note.id, { pinned }).pipe(
              tapResponse({
                next: () => {
                  toast.success(pinned ? 'Note épinglée' : 'Note désépinglée');
                  reload();
                },
                error: (error) => {
                  patchState(
                    store,
                    updateEntity({ id: note.id, changes: { pinned: note.pinned } }),
                  );
                  toast.error(apiErrorMessage(error));
                },
              }),
            );
          }),
        ),
      ),
    };
  }),
);
