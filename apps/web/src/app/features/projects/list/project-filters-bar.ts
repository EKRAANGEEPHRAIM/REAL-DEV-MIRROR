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
import type { ProjectStatus, Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { PROJECT_SORTS, type ProjectFilters, type ProjectSort } from '../project-filters';
import { PROJECT_STATUSES } from '../project-status';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/** Barre de filtres : émet les changements ; la recherche est temporisée (300 ms). */
@Component({
  selector: 'dm-project-filters-bar',
  imports: [NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports],
  providers: [provideIcons({ lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="search" class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      <div class="relative flex-1 md:min-w-64">
        <label hlmLabel for="project-search" class="sr-only">Rechercher un projet</label>
        <ng-icon
          name="lucideSearch"
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          hlmInput
          id="project-search"
          type="search"
          class="w-full ps-9"
          placeholder="Rechercher un projet…"
          [value]="search()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label hlmLabel for="project-status" class="text-muted-foreground text-xs">Statut</label>
        <select
          id="project-status"
          [class]="selectClasses"
          (change)="onStatus($any($event.target).value)"
        >
          <option value="" [selected]="!value().status">Tous</option>
          @for (status of statuses; track status.value) {
            <option [value]="status.value" [selected]="value().status === status.value">
              {{ status.label }}
            </option>
          }
        </select>
      </div>

      @if (tags().length) {
        <div class="flex flex-col gap-1">
          <label hlmLabel for="project-tag" class="text-muted-foreground text-xs">Tag</label>
          <select
            id="project-tag"
            [class]="selectClasses"
            (change)="changed.emit({ tag: $any($event.target).value })"
          >
            <option value="" [selected]="!value().tag">Tous</option>
            @for (tag of tags(); track tag.id) {
              <option [value]="tag.name" [selected]="value().tag === tag.name">
                {{ tag.name }}
              </option>
            }
          </select>
        </div>
      }

      <div class="flex flex-col gap-1">
        <label hlmLabel for="project-sort" class="text-muted-foreground text-xs">Trier par</label>
        <select
          id="project-sort"
          [class]="selectClasses"
          (change)="onSort($any($event.target).value)"
        >
          @for (sort of sorts; track sort.value) {
            <option [value]="sort.value" [selected]="value().sort === sort.value">
              {{ sort.label }}
            </option>
          }
        </select>
      </div>

      <label class="flex h-9 items-center gap-2 text-sm" [class.opacity-50]="!!value().status">
        <input
          type="checkbox"
          class="accent-primary size-4"
          [checked]="value().archived"
          [disabled]="!!value().status"
          (change)="changed.emit({ archived: $any($event.target).checked })"
        />
        Inclure les archivés
      </label>

      @if (active()) {
        <button hlmBtn variant="ghost" size="sm" class="h-9" (click)="cleared.emit()">
          <ng-icon name="lucideX" aria-hidden="true" />
          Réinitialiser
        </button>
      }
    </div>
  `,
})
export class ProjectFiltersBar {
  readonly value = input.required<ProjectFilters>();
  readonly tags = input<readonly Tag[]>([]);
  readonly active = input(false);
  readonly changed = output<Partial<ProjectFilters>>();
  readonly cleared = output<void>();

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly sorts = PROJECT_SORTS;
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

  protected onStatus(value: string): void {
    this.changed.emit({ status: (value || null) as ProjectStatus | null });
  }

  protected onSort(value: string): void {
    this.changed.emit({ sort: value as ProjectSort });
  }
}
