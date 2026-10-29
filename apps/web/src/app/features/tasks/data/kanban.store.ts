import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { computed, inject } from '@angular/core';
import type { Task, TaskListQuery, TaskStatus } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { concatMap, filter, pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TasksApi } from './tasks.api';

export type KanbanColumns = Record<TaskStatus, Task[]>;

/** Nombre maximal de tâches chargées sur le tableau (limite de l'API par page). */
export const BOARD_LIMIT = 100;

export function emptyColumns(): KanbanColumns {
  return { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };
}

/** Répartit les tâches par statut, dans l'ordre de leur position. */
export function groupByStatus(tasks: readonly Task[]): KanbanColumns {
  const columns = emptyColumns();
  for (const task of tasks) columns[task.status].push(task);
  for (const column of Object.values(columns)) column.sort((a, b) => a.position - b.position);
  return columns;
}

interface KanbanState {
  columns: KanbanColumns;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  /** Plus de BOARD_LIMIT tâches correspondent : le tableau n'en montre qu'une partie. */
  truncated: boolean;
}

interface PendingMove {
  status: TaskStatus;
  taskIds: string[];
  /** État du tableau avant le déplacement, restauré si l'API refuse. */
  snapshot: KanbanColumns;
}

export const KanbanStore = signalStore(
  { providedIn: 'root' },
  withState<KanbanState>({
    columns: emptyColumns(),
    status: 'idle',
    error: null,
    truncated: false,
  }),
  withComputed(({ columns }) => ({
    total: computed(() => Object.values(columns()).reduce((sum, column) => sum + column.length, 0)),
  })),
  withMethods((store, api = inject(TasksApi)) => {
    let lastQuery: TaskListQuery | null = null;

    const load = rxMethod<TaskListQuery | null>(
      pipe(
        filter((query): query is TaskListQuery => query !== null),
        tap((query) => {
          lastQuery = query;
          patchState(store, { status: 'loading', error: null });
        }),
        switchMap((query) =>
          api.list({ ...query, page: 1, limit: BOARD_LIMIT, sort: 'position:asc' }).pipe(
            tapResponse({
              next: ({ data, meta }) =>
                patchState(store, {
                  columns: groupByStatus(data),
                  status: 'loaded',
                  truncated: meta.total > data.length,
                }),
              error: (error) =>
                patchState(store, { status: 'error', error: apiErrorMessage(error) }),
            }),
          ),
        ),
      ),
    );

    // concatMap : les déplacements sont envoyés l'un après l'autre, dans l'ordre des gestes.
    const persist = rxMethod<PendingMove>(
      pipe(
        concatMap(({ status, taskIds, snapshot }) =>
          api.reorder({ status, taskIds }).pipe(
            tapResponse({
              next: (tasks) =>
                patchState(store, (state) => ({ columns: { ...state.columns, [status]: tasks } })),
              error: (error) => {
                patchState(store, { columns: snapshot });
                toast.error(
                  translate('tasks.board.moveCancelled', { reason: apiErrorMessage(error) }),
                );
              },
            }),
          ),
        ),
      ),
    );

    /** Déplace une carte (glisser-déposer ou menu), met à jour l'écran puis l'API. */
    const move = (from: TaskStatus, to: TaskStatus, fromIndex: number, toIndex: number): void => {
      if (from === to && fromIndex === toIndex) return;
      const snapshot = store.columns();
      const columns: KanbanColumns = { ...snapshot, [from]: [...snapshot[from]] };

      if (from === to) {
        moveItemInArray(columns[from], fromIndex, toIndex);
      } else {
        columns[to] = [...snapshot[to]];
        transferArrayItem(columns[from], columns[to], fromIndex, toIndex);
        const moved = columns[to][toIndex];
        columns[to][toIndex] = {
          ...moved,
          status: to,
          completedAt: to === 'DONE' ? new Date().toISOString() : null,
        };
      }

      patchState(store, { columns });
      persist({ status: to, taskIds: columns[to].map((task) => task.id), snapshot });
    };

    return {
      load,
      reload: () => {
        if (lastQuery) load(lastQuery);
      },
      move,
      /** Variante clavier : envoie la carte en bas d'une autre colonne. */
      moveTo: (task: Task, to: TaskStatus): void => {
        const fromIndex = store.columns()[task.status].findIndex((t) => t.id === task.id);
        if (fromIndex === -1 || task.status === to) return;
        move(task.status, to, fromIndex, store.columns()[to].length);
      },
    };
  }),
);
