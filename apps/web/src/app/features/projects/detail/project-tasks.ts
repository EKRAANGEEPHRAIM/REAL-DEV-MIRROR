import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Task, TaskListQuery } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideColumns3, lucideList, lucidePlus } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { KanbanBoard } from '../../tasks/board/kanban-board';
import { BOARD_LIMIT, KanbanStore } from '../../tasks/data/kanban.store';
import { TasksStore } from '../../tasks/data/tasks.store';
import { TaskDialogs } from '../../tasks/form/task-dialogs';
import type { TaskDialogResult } from '../../tasks/form/task-form-dialog';
import { TaskRow } from '../../tasks/list/task-row';
import { translate } from '../../../core/i18n/translate';

export type ProjectTasksView = 'list' | 'board';

/**
 * Tâches d'un projet, en liste ou en Kanban. Les stores sont fournis ici : instances propres
 * à la section, sans les données de la page /tasks restées en mémoire.
 */
@Component({
  selector: 'dm-project-tasks',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    KanbanBoard,
    TaskRow,
  ],
  providers: [TasksStore, KanbanStore, provideIcons({ lucideColumns3, lucideList, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard aria-labelledby="tasks-title">
      <div hlmCardHeader class="gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 hlmCardTitle id="tasks-title">{{ t('titles.tasks') }}</h2>
          <div class="flex items-center gap-2">
            <div
              class="bg-muted flex rounded-lg p-0.5"
              role="group"
              [attr.aria-label]="t('tasks.view.label')"
            >
              <button
                hlmBtn
                size="sm"
                [variant]="board() ? 'ghost' : 'outline'"
                [attr.aria-pressed]="!board()"
                (click)="viewChange.emit('list')"
              >
                <ng-icon name="lucideList" aria-hidden="true" />
                {{ t('tasks.view.list') }}
              </button>
              <button
                hlmBtn
                size="sm"
                [variant]="board() ? 'outline' : 'ghost'"
                [attr.aria-pressed]="board()"
                (click)="viewChange.emit('board')"
              >
                <ng-icon name="lucideColumns3" aria-hidden="true" />
                {{ t('tasks.view.board') }}
              </button>
            </div>
            <button hlmBtn size="sm" (click)="create()">
              <ng-icon name="lucidePlus" aria-hidden="true" />
              {{ t('tasks.new') }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <p hlmCardDescription aria-live="polite">
            @if (progress().total) {
              {{
                t('projects.detail.progress', {
                  count: progress().done,
                  total: progress().total,
                  percent: progress().percent,
                })
              }}
            } @else if (loaded()) {
              {{ t('projects.detail.noTasks') }}
            }
          </p>
          <div
            class="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            [attr.aria-valuenow]="progress().percent"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="t('projects.detail.progressLabel')"
          >
            <div
              class="bg-primary h-full rounded-full transition-all"
              [style.width.%]="progress().percent"
            ></div>
          </div>
        </div>
      </div>

      <div hlmCardContent>
        @if (board()) {
          <dm-kanban-board
            [showProject]="false"
            (opened)="edit($event)"
            (created)="create($event)"
          />
        } @else if (tasks.status() === 'error') {
          <div class="flex flex-col items-start gap-3">
            <dm-form-alert>{{ tasks.error() }}</dm-form-alert>
            <button hlmBtn variant="outline" size="sm" (click)="tasks.reload()">
              {{ t('common.retry') }}
            </button>
          </div>
        } @else if (tasks.isInitialLoading()) {
          <div class="flex flex-col gap-2" aria-busy="true" [attr.aria-label]="t('tasks.loading')">
            <hlm-skeleton class="h-14 w-full rounded-lg" />
            <hlm-skeleton class="h-14 w-full rounded-lg" />
          </div>
        } @else if (tasks.isEmpty()) {
          <div
            class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center"
          >
            <p class="text-muted-foreground text-sm">
              {{ t('projects.detail.emptyTasks') }}
            </p>
            <button hlmBtn variant="outline" (click)="create()">
              <ng-icon name="lucidePlus" aria-hidden="true" />
              {{ t('tasks.add') }}
            </button>
          </div>
        } @else {
          <ul class="flex flex-col gap-2">
            @for (task of tasks.entities(); track task.id) {
              <li>
                <dm-task-row
                  [task]="task"
                  (toggled)="tasks.toggleDone($event)"
                  (opened)="edit($event)"
                />
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class ProjectTasks {
  protected readonly t = translate;
  readonly projectId = input.required<string>();
  readonly view = input<ProjectTasksView>('list');
  readonly viewChange = output<ProjectTasksView>();

  protected readonly tasks = inject(TasksStore);
  private readonly kanban = inject(KanbanStore);
  private readonly dialogs = inject(TaskDialogs);

  protected readonly board = computed(() => this.view() === 'board');

  // Une seule vue charge ses données ; toutes les tâches du projet tiennent sur une page.
  private readonly listQuery = computed<TaskListQuery | null>(() =>
    this.board() ? null : { projectId: this.projectId(), limit: BOARD_LIMIT, sort: 'position:asc' },
  );
  private readonly boardQuery = computed<TaskListQuery | null>(() =>
    this.board() ? { projectId: this.projectId() } : null,
  );

  protected readonly loaded = computed(() =>
    this.board() ? this.kanban.status() === 'loaded' : this.tasks.status() === 'loaded',
  );

  /** Progression recalculée à partir des tâches affichées : elle suit chaque coche ou déplacement. */
  protected readonly progress = computed(() => {
    const all = this.board() ? Object.values(this.kanban.columns()).flat() : this.tasks.entities();
    const done = all.filter((task) => task.status === 'DONE').length;
    return {
      total: all.length,
      done,
      percent: all.length ? Math.round((done / all.length) * 100) : 0,
    };
  });

  constructor() {
    this.tasks.load(this.listQuery);
    this.kanban.load(this.boardQuery);
  }

  protected create(status?: Task['status']): void {
    this.dialogs.open(undefined, { projectId: this.projectId(), status }).subscribe((result) => {
      if (result?.type !== 'saved') return;
      toast.success(translate('tasks.toast.created'));
      this.refresh();
    });
  }

  protected edit(task: Task): void {
    this.dialogs.open(task).subscribe((result: TaskDialogResult | undefined) => {
      if (result?.type === 'saved') toast.success(translate('tasks.toast.saved'));
      if (result?.type === 'deleted') toast.success(translate('tasks.toast.deleted'));
      // La tâche a pu changer de statut, quitter le projet ou être supprimée.
      this.refresh();
    });
  }

  private refresh(): void {
    if (this.board()) this.kanban.reload();
    else this.tasks.reload();
  }
}
