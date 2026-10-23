import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { Project, Task, TaskStatus } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideColumns3,
  lucideList,
  lucideListTodo,
  lucidePlus,
  lucideRefreshCw,
  lucideSearchX,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { catchError, map, of } from 'rxjs';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { Pagination } from '../../../shared/ui-kit/pagination';
import { ProjectsApi } from '../../projects/data/projects.api';
import { pageFromUrl } from '../../projects/project-filters';
import { KanbanBoard } from '../board/kanban-board';
import { KanbanStore } from '../data/kanban.store';
import { TasksStore } from '../data/tasks.store';
import { TaskDialogs } from '../form/task-dialogs';
import type { TaskDialogResult } from '../form/task-form-dialog';
import {
  hasActiveTaskFilters,
  type TaskFilters,
  taskFiltersFromUrl,
  taskFiltersToUrl,
  toTaskQuery,
} from '../task-filters';
import { TaskFiltersBar } from './task-filters-bar';
import { TaskRow } from './task-row';

@Component({
  selector: 'dm-tasks-page',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmSkeletonImports,
    FormAlert,
    Pagination,
    TaskFiltersBar,
    TaskRow,
    KanbanBoard,
  ],
  providers: [
    provideIcons({
      lucideColumns3,
      lucideList,
      lucideListTodo,
      lucidePlus,
      lucideRefreshCw,
      lucideSearchX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">
        Tâches
        @if (count() !== null) {
          <span class="text-muted-foreground ms-1 text-base font-normal">({{ count() }})</span>
        }
      </h1>
      <div class="flex items-center gap-2">
        <div class="bg-muted flex rounded-lg p-0.5" role="group" aria-label="Affichage">
          <button
            hlmBtn
            size="sm"
            [variant]="board() ? 'ghost' : 'outline'"
            [attr.aria-pressed]="!board()"
            (click)="setView(null)"
          >
            <ng-icon name="lucideList" aria-hidden="true" />
            Liste
          </button>
          <button
            hlmBtn
            size="sm"
            [variant]="board() ? 'outline' : 'ghost'"
            [attr.aria-pressed]="board()"
            (click)="setView('board')"
          >
            <ng-icon name="lucideColumns3" aria-hidden="true" />
            Kanban
          </button>
        </div>
        <button hlmBtn (click)="create()">
          <ng-icon name="lucidePlus" aria-hidden="true" />
          Nouvelle tâche
        </button>
      </div>
    </header>

    <dm-task-filters-bar
      class="mb-6 block"
      [value]="filters()"
      [projects]="projects()"
      [active]="filtered()"
      [board]="board()"
      (changed)="updateFilters($event)"
      (cleared)="resetFilters()"
    />

    @if (board()) {
      <dm-kanban-board (opened)="edit($event)" (created)="create($event)" />
    } @else if (store.status() === 'error' && !store.entities().length) {
      <div class="flex max-w-xl flex-col items-start gap-3">
        <dm-form-alert>{{ store.error() }}</dm-form-alert>
        <button hlmBtn variant="outline" (click)="store.reload()">
          <ng-icon name="lucideRefreshCw" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    } @else if (store.isInitialLoading()) {
      <div class="flex flex-col gap-2" aria-busy="true" aria-label="Chargement des tâches">
        @for (i of skeletons; track i) {
          <hlm-skeleton class="h-14 w-full rounded-lg" />
        }
      </div>
    } @else if (store.isEmpty()) {
      <section
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
      >
        @if (filtered()) {
          <ng-icon name="lucideSearchX" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h2 class="text-lg font-medium">Aucune tâche ne correspond</h2>
          <button hlmBtn variant="outline" (click)="resetFilters()">
            Réinitialiser les filtres
          </button>
        } @else {
          <ng-icon
            name="lucideListTodo"
            class="text-muted-foreground text-4xl"
            aria-hidden="true"
          />
          <h2 class="text-lg font-medium">Aucune tâche pour l’instant</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            Notez ce qu’il reste à faire, avec une échéance et une priorité.
          </p>
          <button hlmBtn (click)="create()">
            <ng-icon name="lucidePlus" aria-hidden="true" />
            Créer une tâche
          </button>
        }
      </section>
    } @else {
      <ul
        class="flex flex-col gap-2 transition-opacity"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @for (task of store.entities(); track task.id) {
          <li>
            <dm-task-row
              [task]="task"
              (toggled)="store.toggleDone($event)"
              (opened)="edit($event)"
            />
          </li>
        }
      </ul>

      @if (store.meta(); as meta) {
        @if (meta.totalPages > 1) {
          <dm-pagination
            class="mt-6 block"
            [page]="meta.page"
            [totalPages]="meta.totalPages"
            [total]="meta.total"
            itemLabel="tâche"
            itemsLabel="tâches"
            (pageChange)="goToPage($event)"
          />
        }
      }
    }
  `,
})
export class TasksPage {
  readonly view = input<string>();
  readonly project = input<string>();
  readonly status = input<string>();
  readonly priority = input<string>();
  readonly due = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly store = inject(TasksStore);
  private readonly kanban = inject(KanbanStore);
  private readonly dialogs = inject(TaskDialogs);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);

  protected readonly board = computed(() => this.view() === 'board');
  protected readonly filters = computed(() =>
    taskFiltersFromUrl({
      project: this.project(),
      // Sur le tableau, les colonnes remplacent le filtre de statut.
      status: this.board() ? undefined : this.status(),
      priority: this.priority(),
      due: this.due(),
      q: this.q(),
      sort: this.sort(),
    }),
  );
  protected readonly filtered = computed(() => hasActiveTaskFilters(this.filters()));

  // Une seule vue charge ses données ; l'autre reçoit null.
  private readonly listQuery = computed(() =>
    this.board() ? null : toTaskQuery(this.filters(), pageFromUrl(this.page())),
  );
  private readonly boardQuery = computed(() =>
    this.board() ? toTaskQuery(this.filters(), 1) : null,
  );

  protected readonly count = computed(() => {
    if (this.board()) return this.kanban.status() === 'loaded' ? this.kanban.total() : null;
    return this.store.status() === 'loaded' ? this.store.total() : null;
  });

  protected readonly projects = toSignal(
    inject(ProjectsApi)
      .list({ limit: 100, sort: 'name:asc' })
      .pipe(
        map((page) => page.data),
        catchError(() => of([] as Project[])),
      ),
    { initialValue: [] as Project[] },
  );
  protected readonly skeletons = [1, 2, 3, 4, 5];

  constructor() {
    this.store.load(this.listQuery);
    this.kanban.load(this.boardQuery);
  }

  protected setView(view: 'board' | null): void {
    this.navigate({ view, page: null, ...(view === 'board' && { status: null, sort: null }) });
  }

  protected create(status?: TaskStatus): void {
    this.dialogs.open(undefined, { status }).subscribe((result) => {
      if (result?.type !== 'saved') return;
      toast.success('Tâche créée');
      this.refresh();
    });
  }

  protected edit(task: Task): void {
    this.dialogs.open(task).subscribe((result) => this.applyResult(result));
  }

  private applyResult(result: TaskDialogResult | undefined): void {
    if (result?.type === 'saved') toast.success('Tâche enregistrée');
    if (result?.type === 'deleted') toast.success('Tâche supprimée');

    if (this.board()) {
      // Le statut ou la position ont pu changer : on recharge le tableau.
      this.kanban.reload();
    } else if (result?.type === 'saved') {
      this.store.upsert(result.task);
    } else {
      if (result?.type === 'deleted') this.store.removeLocal(result.id);
      // Suppression, ou fenêtre fermée après avoir modifié la checklist.
      this.store.reload();
    }
  }

  private refresh(): void {
    if (this.board()) this.kanban.reload();
    else this.store.reload();
  }

  protected updateFilters(change: Partial<TaskFilters>): void {
    this.navigate({ ...taskFiltersToUrl(change), page: null });
  }

  protected goToPage(page: number): void {
    this.navigate({ page: page > 1 ? String(page) : null });
    this.scroller.scrollToPosition([0, 0]);
  }

  protected resetFilters(): void {
    // Garde la vue choisie (liste ou Kanban).
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.board() ? { view: 'board' } : {},
    });
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
