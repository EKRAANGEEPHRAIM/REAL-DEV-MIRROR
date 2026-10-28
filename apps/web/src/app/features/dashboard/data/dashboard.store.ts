import { computed, inject } from '@angular/core';
import type { DueTask, StatsOverview } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { exhaustMap, mergeMap, pipe, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { TasksApi } from '../../tasks/data/tasks.api';
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
  withMethods((store, api = inject(StatsApi), tasks = inject(TasksApi)) => {
    /** exhaustMap : un double clic sur « Actualiser » ne lance pas deux requêtes. */
    const load = rxMethod<void>(
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
    );

    const setDueSoon = (update: (tasks: DueTask[]) => DueTask[]) => {
      const overview = store.overview();
      if (overview)
        patchState(store, { overview: { ...overview, dueSoon: update(overview.dueSoon) } });
    };

    return {
      load,

      /**
       * Termine une tâche depuis la liste « à faire sous 7 jours » : elle disparaît aussitôt,
       * revient si l'API refuse ; sinon les chiffres sont relus (tuiles, graphiques, série).
       */
      completeTask: rxMethod<DueTask>(
        pipe(
          mergeMap((task) => {
            const position = store.overview()?.dueSoon.findIndex((t) => t.id === task.id) ?? -1;
            setDueSoon((list) => list.filter((t) => t.id !== task.id));
            return tasks.update(task.id, { status: 'DONE' }).pipe(
              tapResponse({
                next: () => {
                  toast.success(`« ${task.title} » terminée`);
                  load();
                },
                error: (error) => {
                  setDueSoon((list) => {
                    const restored = [...list];
                    restored.splice(Math.max(0, position), 0, task);
                    return restored;
                  });
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
