import { computed, inject } from '@angular/core';
import type { PaginationMeta, Task, TaskListQuery } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  removeEntity,
  setAllEntities,
  setEntity,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { filter, mergeMap, pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { TasksApi } from './tasks.api';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface TasksState {
  meta: PaginationMeta | null;
  status: LoadStatus;
  error: string | null;
}

/** Tâches de la vue liste ; les filtres vivent dans l'URL (voir TasksPage). */
export const TasksStore = signalStore(
  { providedIn: 'root' },
  withEntities<Task>(),
  withState<TasksState>({ meta: null, status: 'idle', error: null }),
  withComputed(({ entities, status, meta }) => ({
    isInitialLoading: computed(() => status() === 'loading' && entities().length === 0),
    isRefreshing: computed(() => status() === 'loading' && entities().length > 0),
    isEmpty: computed(() => status() === 'loaded' && entities().length === 0),
    total: computed(() => meta()?.total ?? 0),
  })),
  withMethods((store, api = inject(TasksApi)) => {
    let lastQuery: TaskListQuery | null = null;

    // null : vue liste inactive (Kanban affiché), rien à charger.
    const load = rxMethod<TaskListQuery | null>(
      pipe(
        filter((query): query is TaskListQuery => query !== null),
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
      /** Remplace une tâche par la version renvoyée par l'API. */
      upsert: (task: Task) => patchState(store, setEntity(task)),

      /**
       * Coche / décoche une tâche de façon optimiste : la liste change tout de suite et
       * revient à l'état précédent si l'API refuse. mergeMap : plusieurs tâches en parallèle.
       */
      toggleDone: rxMethod<Task>(
        pipe(
          mergeMap((task) => {
            const status = task.status === 'DONE' ? 'TODO' : 'DONE';
            patchState(
              store,
              updateEntity({
                id: task.id,
                changes: {
                  status,
                  completedAt: status === 'DONE' ? new Date().toISOString() : null,
                },
              }),
            );
            return api.update(task.id, { status }).pipe(
              tapResponse({
                next: (saved) => patchState(store, setEntity(saved)),
                error: (error) => {
                  patchState(store, setEntity(task));
                  toast.error(apiErrorMessage(error));
                },
              }),
            );
          }),
        ),
      ),

      removeLocal: (id: string) => patchState(store, removeEntity(id)),
    };
  }),
);
