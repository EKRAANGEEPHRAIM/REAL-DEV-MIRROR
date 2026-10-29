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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { GOAL_SORTS, GOAL_STATES, type GoalFilters, type GoalSort } from '../goal-filters';
import { translate } from '../../../core/i18n/translate';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/** Onglets d'état, recherche temporisée (300 ms) et tri ; émet les changements. */
@Component({
  selector: 'dm-goal-filters-bar',
  imports: [NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports],
  providers: [provideIcons({ lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="search" class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      <div
        class="bg-muted inline-flex h-9 w-fit rounded-md p-1"
        role="group"
        [attr.aria-label]="t('goals.filters.state')"
      >
        @for (state of states; track state.label) {
          <button
            type="button"
            class="rounded px-3 text-sm font-medium transition-colors"
            [class.bg-background]="value().state === state.value"
            [class.shadow-sm]="value().state === state.value"
            [class.text-muted-foreground]="value().state !== state.value"
            [attr.aria-pressed]="value().state === state.value"
            (click)="changed.emit({ state: state.value })"
          >
            {{ t(state.label) }}
          </button>
        }
      </div>

      <div class="relative flex-1 md:min-w-64">
        <label hlmLabel for="goal-search" class="sr-only">{{ t('goals.filters.search') }}</label>
        <ng-icon
          name="lucideSearch"
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          hlmInput
          id="goal-search"
          type="search"
          class="w-full ps-9"
          [placeholder]="t('goals.filters.searchPlaceholder')"
          [value]="search()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label hlmLabel for="goal-sort" class="text-muted-foreground text-xs">{{
          t('common.sortBy')
        }}</label>
        <select id="goal-sort" [class]="selectClasses" (change)="onSort($any($event.target).value)">
          @for (sort of sorts; track sort.value) {
            <option [value]="sort.value" [selected]="value().sort === sort.value">
              {{ t(sort.label) }}
            </option>
          }
        </select>
      </div>

      @if (active()) {
        <button hlmBtn variant="ghost" size="sm" class="h-9" (click)="cleared.emit()">
          <ng-icon name="lucideX" aria-hidden="true" />
          {{ t('common.reset') }}
        </button>
      }
    </div>
  `,
})
export class GoalFiltersBar {
  protected readonly t = translate;
  readonly value = input.required<GoalFilters>();
  readonly active = input(false);
  readonly changed = output<Partial<GoalFilters>>();
  readonly cleared = output<void>();

  protected readonly states = GOAL_STATES;
  protected readonly sorts = GOAL_SORTS;
  protected readonly selectClasses = SELECT_CLASSES;
  /** Texte saisi, resynchronisé quand l'URL change (retour arrière, réinitialisation). */
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

  protected onSort(value: string): void {
    this.changed.emit({ sort: value as GoalSort });
  }
}
