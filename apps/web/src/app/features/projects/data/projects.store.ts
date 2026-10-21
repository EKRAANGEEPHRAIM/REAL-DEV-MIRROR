import { computed, inject } from '@angular/core';
import type { PaginationMeta, Project, ProjectListQuery } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { ProjectsApi } from './projects.api';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface ProjectsState {
  meta: PaginationMeta | null;
  status: LoadStatus;
  error: string | null;
}

/**
 * Projets de la page courante. Les filtres vivent dans l'URL : la page passe la requête
 * à `load`, qui relance l'appel à chaque changement et annule le précédent (switchMap).
 * Fourni à la racine : en revenant sur la liste, les projets déjà chargés s'affichent
 * immédiatement pendant le rafraîchissement.
 */
export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Project>(),
  withState<ProjectsState>({ meta: null, status: 'idle', error: null }),
  withComputed(({ entities, status, meta }) => ({
    /** Premier chargement : rien à montrer encore, on affiche des squelettes. */
    isInitialLoading: computed(() => status() === 'loading' && entities().length === 0),
    /** Rafraîchissement : les cartes restent visibles, atténuées. */
    isRefreshing: computed(() => status() === 'loading' && entities().length > 0),
    isEmpty: computed(() => status() === 'loaded' && entities().length === 0),
    total: computed(() => meta()?.total ?? 0),
  })),
  withMethods((store, api = inject(ProjectsApi)) => {
    let lastQuery: ProjectListQuery | null = null;

    const load = rxMethod<ProjectListQuery>(
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
      /** Recharge la dernière page demandée (après une création ou une suppression). */
      reload: () => {
        if (lastQuery) load(lastQuery);
      },
    };
  }),
);
