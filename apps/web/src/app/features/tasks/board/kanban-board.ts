import {
  CdkDrag,
  type CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { Task, TaskStatus } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { BOARD_LIMIT, KanbanStore } from '../data/kanban.store';
import { TASK_STATUSES } from '../task-meta';
import { KanbanCard } from './kanban-card';
import { translate } from '../../../core/i18n/translate';

/** Tableau Kanban à quatre colonnes ; les données viennent du KanbanStore. */
@Component({
  selector: 'dm-kanban-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    NgIcon,
    HlmButtonImports,
    HlmSkeletonImports,
    FormAlert,
    KanbanCard,
  ],
  providers: [provideIcons({ lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.status() === 'error') {
      <div class="flex max-w-xl flex-col items-start gap-3">
        <dm-form-alert>{{ store.error() }}</dm-form-alert>
        <button hlmBtn variant="outline" (click)="store.reload()">{{ t('common.retry') }}</button>
      </div>
    } @else {
      @if (store.truncated()) {
        <p class="text-muted-foreground mb-3 text-sm" role="status">
          {{ t('tasks.board.truncated', { limit }) }}
        </p>
      }
      <div
        cdkDropListGroup
        class="relative -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4"
        [attr.aria-busy]="store.status() === 'loading'"
      >
        @for (column of columns; track column.value) {
          <section
            class="bg-muted/40 flex w-72 shrink-0 snap-start flex-col rounded-xl border md:w-auto"
            [attr.aria-labelledby]="'column-' + column.value"
          >
            <header class="flex items-center justify-between gap-2 px-3 py-2.5">
              <h2
                [id]="'column-' + column.value"
                class="flex items-center gap-2 text-sm font-semibold"
              >
                <span class="rounded-full px-2 py-0.5 text-xs" [class]="column.tone">{{
                  t(column.label)
                }}</span>
                <span class="text-muted-foreground font-normal"
                  ><span class="sr-only">, </span>{{ store.columns()[column.value].length
                  }}<span class="sr-only">
                    {{
                      t('tasks.board.countSuffix', { count: store.columns()[column.value].length })
                    }}</span
                  ></span
                >
              </h2>
              <button
                hlmBtn
                variant="ghost"
                size="icon-sm"
                [attr.aria-label]="t('tasks.board.newIn', { column: t(column.label) })"
                (click)="created.emit(column.value)"
              >
                <ng-icon name="lucidePlus" aria-hidden="true" />
              </button>
            </header>

            <div
              cdkDropList
              [id]="column.value"
              [cdkDropListData]="column.value"
              class="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2"
              (cdkDropListDropped)="drop($event)"
            >
              @if (store.status() === 'loading' && store.total() === 0) {
                <hlm-skeleton class="h-20 w-full rounded-lg" />
              }
              @for (task of store.columns()[column.value]; track task.id) {
                <dm-kanban-card
                  cdkDrag
                  [cdkDragData]="task"
                  class="cursor-grab active:cursor-grabbing"
                  [task]="task"
                  [showProject]="showProject()"
                  (opened)="opened.emit($event)"
                  (moved)="store.moveTo(task, $event)"
                >
                  <div
                    *cdkDragPlaceholder
                    class="border-primary/40 bg-primary/5 h-16 rounded-lg border-2 border-dashed"
                  ></div>
                </dm-kanban-card>
              } @empty {
                @if (store.status() === 'loaded') {
                  <p class="text-muted-foreground py-6 text-center text-xs">
                    {{ t('tasks.board.dropHere') }}
                  </p>
                }
              }
            </div>
          </section>
        }
      </div>
    }
  `,
})
export class KanbanBoard {
  protected readonly t = translate;
  protected readonly store = inject(KanbanStore);
  protected readonly columns = TASK_STATUSES;
  protected readonly limit = BOARD_LIMIT;

  readonly showProject = input(true);
  readonly opened = output<Task>();
  /** Bouton « + » d'une colonne : nouvelle tâche avec ce statut. */
  readonly created = output<TaskStatus>();

  protected drop(event: CdkDragDrop<TaskStatus, TaskStatus, Task>): void {
    this.store.move(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
  }
}
