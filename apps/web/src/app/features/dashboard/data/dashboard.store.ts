import { computed, inject } from '@angular/core';
import type { StatsOverview } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, pipe, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { buildTiles } from '../dashboard-tiles';
import { StatsApi } from './stats.api';

interface DashboardState {
  overview: StatsOverview | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
}

/**
 * Tableau de bord : une seule requête (/stats/overview) alimente tuiles, graphiques et listes.
 * Fourni à la racine : au retour sur la page, les derniers chiffres s'affichent aussitôt
 * pendant le rafraîchissement.
 */
export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState<DashboardState>({ overview: null, status: 'idle', error: null }),
  withComputed(({ overview, status }) => ({
    isInitialLoading: computed(() => status() === 'loading' && !overview()),
    isRefreshing: computed(() => status() === 'loading' && !!overview()),
    tiles: computed(() => {
      const data = overview();
      return data ? buildTiles(data) : [];
    }),
    overdueTasks: computed(() => overview()?.indicators.overdueTasks ?? 0),
  })),
  withMethods((store, api = inject(StatsApi)) => ({
    /** exhaustMap : un double clic sur « Actualiser » ne lance pas deux requêtes. */
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        exhaustMap(() =>
          api.overview().pipe(
            tapResponse({
              next: (overview) => patchState(store, { overview, status: 'loaded' }),
              error: (error) =>
                patchState(store, { status: 'error', error: apiErrorMessage(error) }),
            }),
          ),
        ),
      ),
    ),
  })),
);
