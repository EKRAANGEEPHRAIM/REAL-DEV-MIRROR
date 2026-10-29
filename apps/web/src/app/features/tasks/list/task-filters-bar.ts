import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Project } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { DUE_FILTERS } from '../task-dates';
import { NO_PROJECT, TASK_SORTS, type TaskFilters } from '../task-filters';
import { TASK_PRIORITIES, TASK_STATUSES } from '../task-meta';
import { translate } from '../../../core/i18n/translate';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/** Filtres de la liste des tâches ; une valeur vide (« Tous ») est émise comme null. */
@Component({
  selector: 'dm-task-filters-bar',
  imports: [NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports],
  providers: [provideIcons({ lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="search" class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      <div class="relative flex-1 md:min-w-56">
        <label hlmLabel for="task-search" class="sr-only">{{ t('tasks.filters.search') }}</label>
        <ng-icon
          name="lucideSearch"
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          hlmInput
          id="task-search"
          type="search"
          class="w-full ps-9"
          [placeholder]="t('tasks.filters.searchPlaceholder')"
          [value]="search()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label hlmLabel for="task-filter-due" class="text-muted-foreground text-xs">{{
          t('tasks.filters.due')
        }}</label>
        <select
          id="task-filter-due"
          [class]="selectClasses"
          (change)="emit('due', $any($event.target).value)"
        >
          <option value="" [selected]="!value().due">{{ t('tasks.filters.allFeminine') }}</option>
          @for (due of dueFilters; track due.value) {
            <option [value]="due.value" [selected]="value().due === due.value">
              {{ t(due.label) }}
            </option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-1">
        <label hlmLabel for="task-filter-project" class="text-muted-foreground text-xs">{{
          t('tasks.filters.project')
        }}</label>
        <select
          id="task-filter-project"
          [class]="selectClasses"
          (change)="emit('project', $any($event.target).value)"
        >
          <option value="" [selected]="!value().project">{{ t('common.all') }}</option>
          <option [value]="noProject" [selected]="value().project === noProject">
            {{ t('tasks.filters.noProject') }}
          </option>
          @for (project of projects(); track project.id) {
            <option [value]="project.id" [selected]="value().project === project.id">
              {{ project.name }}
            </option>
          }
        </select>
      </div>

      <!-- Sur le Kanban, les colonnes tiennent lieu de statut et d'ordre. -->
      @if (!board()) {
        <div class="flex flex-col gap-1">
          <label hlmLabel for="task-filter-status" class="text-muted-foreground text-xs">{{
            t('projects.form.status')
          }}</label>
          <select
            id="task-filter-status"
            [class]="selectClasses"
            (change)="emit('status', $any($event.target).value)"
          >
            <option value="" [selected]="!value().status">{{ t('common.all') }}</option>
            @for (status of statuses; track status.value) {
              <option [value]="status.value" [selected]="value().status === status.value">
                {{ t(status.label) }}
              </option>
            }
          </select>
        </div>
      }

      <div class="flex flex-col gap-1">
        <label hlmLabel for="task-filter-priority" class="text-muted-foreground text-xs">{{
          t('tasks.form.priority')
        }}</label>
        <select
          id="task-filter-priority"
          [class]="selectClasses"
          (change)="emit('priority', $any($event.target).value)"
        >
          <option value="" [selected]="!value().priority">
            {{ t('tasks.filters.allFeminine') }}
          </option>
          @for (priority of priorities; track priority.value) {
            <option [value]="priority.value" [selected]="value().priority === priority.value">
              {{ t(priority.label) }}
            </option>
          }
        </select>
      </div>

      @if (!board()) {
        <div class="flex flex-col gap-1">
          <label hlmLabel for="task-filter-sort" class="text-muted-foreground text-xs">{{
            t('common.sortBy')
          }}</label>
          <select
            id="task-filter-sort"
            [class]="selectClasses"
            (change)="emit('sort', $any($event.target).value)"
          >
            @for (sort of sorts; track sort.value) {
              <option [value]="sort.value" [selected]="value().sort === sort.value">
                {{ t(sort.label) }}
              </option>
            }
          </select>
        </div>
      }

      @if (active()) {
        <button hlmBtn variant="ghost" size="sm" class="h-9" (click)="cleared.emit()">
          <ng-icon name="lucideX" aria-hidden="true" />
          {{ t('common.reset') }}
        </button>
      }
    </div>
  `,
})
export class TaskFiltersBar {
  protected readonly t = translate;
  readonly value = input.required<TaskFilters>();
  readonly projects = input<readonly Project[]>([]);
  readonly active = input(false);
  /** Vue Kanban : masque les filtres de statut et de tri. */
  readonly board = input(false);
  readonly changed = output<Partial<TaskFilters>>();
  readonly cleared = output<void>();

  protected readonly dueFilters = DUE_FILTERS;
  protected readonly statuses = TASK_STATUSES;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly sorts = TASK_SORTS;
  protected readonly noProject = NO_PROJECT;
  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly search = linkedSignal(() => this.value().q);

  private readonly searchInput = new Subject<string>();

  constructor() {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => this.changed.emit({ q: q.trim() }));
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.searchInput.next(value);
  }

  protected emit(key: 'due' | 'project' | 'status' | 'priority' | 'sort', value: string): void {
    this.changed.emit({ [key]: value || null } as Partial<TaskFilters>);
  }
}
