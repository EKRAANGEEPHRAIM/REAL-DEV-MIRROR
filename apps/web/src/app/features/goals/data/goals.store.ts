import { computed, inject } from '@angular/core';
import type { Goal, GoalListQuery, PaginationMeta } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { removeEntity, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { mergeMap, pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { withMilestones } from '../goal-meta';
import { GoalsApi } from './goals.api';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface GoalsState {
  meta: PaginationMeta | null;
  status: LoadStatus;
  error: string | null;
}

/** Objectifs de la page courante ; les filtres vivent dans l'URL (voir GoalsPage). */
export const GoalsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Goal>(),
  withState<GoalsState>({ meta: null, status: 'idle', error: null }),
  withComputed(({ entities, status, meta }) => ({
    isInitialLoading: computed(() => status() === 'loading' && entities().length === 0),
    isRefreshing: computed(() => status() === 'loading' && entities().length > 0),
    isEmpty: computed(() => status() === 'loaded' && entities().length === 0),
    total: computed(() => meta()?.total ?? 0),
  })),
  withMethods((store, api = inject(GoalsApi)) => {
    let lastQuery: GoalListQuery | null = null;

    const load = rxMethod<GoalListQuery>(
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

    /** Coche ou décoche un jalon dans l'objectif tel qu'il est actuellement dans le store. */
    const setMilestoneDone = (goalId: string, milestoneId: string, done: boolean): Goal | null => {
      const goal = store.entityMap()[goalId];
      if (!goal) return null;
      const updated = withMilestones(
        goal,
        goal.milestones.map((m) => (m.id === milestoneId ? { ...m, done } : m)),
      );
      patchState(store, setEntity(updated));
      return updated;
    };

    return {
      load,
      reload: () => {
        if (lastQuery) load(lastQuery);
      },
      upsert: (goal: Goal) => patchState(store, setEntity(goal)),
      removeLocal: (id: string) => patchState(store, removeEntity(id)),

      /**
       * Coche / décoche un jalon de façon optimiste : progression recalculée tout de suite,
       * annulée pour ce seul jalon si l'API refuse. mergeMap : plusieurs jalons en parallèle.
       */
      toggleMilestone: rxMethod<{ goalId: string; milestoneId: string }>(
        pipe(
          mergeMap(({ goalId, milestoneId }) => {
            const before = store.entityMap()[goalId];
            const milestone = before?.milestones.find((m) => m.id === milestoneId);
            if (!before || !milestone) return [];

            const done = !milestone.done;
            const after = setMilestoneDone(goalId, milestoneId, done);
            if (after?.completed && !before.completed) {
              toast.success(translate('goals.toast.completed', { name: before.title }));
            }
            return api.updateMilestone(goalId, milestoneId, { done }).pipe(
              tapResponse({
                next: () => undefined,
                error: (error) => {
                  setMilestoneDone(goalId, milestoneId, milestone.done);
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
