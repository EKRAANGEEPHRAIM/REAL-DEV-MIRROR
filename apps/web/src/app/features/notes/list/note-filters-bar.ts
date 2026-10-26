import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { defaultSortLabel, NOTE_SORTS, type NoteFilters, type NoteSort } from '../note-filters';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/** Recherche plein texte temporisée (300 ms), tri, et puces de tags pour filtrer. */
@Component({
  selector: 'dm-note-filters-bar',
  imports: [NgIcon, HlmButtonImports, HlmInputImports, HlmLabelImports],
  providers: [provideIcons({ lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="search" class="flex flex-col gap-3">
      <div class="flex flex-col gap-3 md:flex-row md:items-end">
        <div class="relative flex-1">
          <label hlmLabel for="note-search" class="sr-only">Rechercher dans les notes</label>
          <ng-icon
            name="lucideSearch"
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            hlmInput
            id="note-search"
            type="search"
            class="w-full ps-9"
            placeholder="Rechercher dans les titres et le contenu…"
            [value]="search()"
            (input)="onSearch($any($event.target).value)"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label hlmLabel for="note-sort" class="text-muted-foreground text-xs">Trier par</label>
          <select
            id="note-sort"
            [class]="selectClasses"
            (change)="onSort($any($event.target).value)"
          >
            <option value="" [selected]="!value().sort">{{ defaultLabel() }}</option>
            @for (sort of sorts(); track sort.value) {
              <option [value]="sort.value" [selected]="value().sort === sort.value">
                {{ sort.label }}
              </option>
            }
          </select>
        </div>
        @if (active()) {
          <button hlmBtn variant="ghost" size="sm" class="h-9" (click)="cleared.emit()">
            <ng-icon name="lucideX" aria-hidden="true" />
            Réinitialiser
          </button>
        }
      </div>

      @if (tags().length) {
        <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par tag">
          <button
            type="button"
            class="rounded-full border px-2.5 py-0.5 text-xs font-medium"
            [class.bg-primary]="!value().tag"
            [class.text-primary-foreground]="!value().tag"
            [attr.aria-pressed]="!value().tag"
            (click)="changed.emit({ tag: '' })"
          >
            Tous les tags
          </button>
          @for (tag of tags(); track tag.id) {
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
              [class.bg-primary]="value().tag === tag.name"
              [class.text-primary-foreground]="value().tag === tag.name"
              [attr.aria-pressed]="value().tag === tag.name"
              (click)="changed.emit({ tag: value().tag === tag.name ? '' : tag.name })"
            >
              @if (tag.color) {
                <span
                  class="size-2 rounded-full"
                  [style.background-color]="tag.color"
                  aria-hidden="true"
                ></span>
              }
              #{{ tag.name }}
              <span class="opacity-60">{{ tag.usage.notes }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class NoteFiltersBar {
  readonly value = input.required<NoteFilters>();
  /** Tags utilisés par au moins une note. */
  readonly tags = input<readonly Tag[]>([]);
  readonly active = input(false);
  readonly changed = output<Partial<NoteFilters>>();
  readonly cleared = output<void>();

  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly defaultLabel = computed(() => defaultSortLabel(this.value()));
  /** Sans recherche, « Récemment modifiées » est déjà l'ordre par défaut. */
  protected readonly sorts = computed(() =>
    this.value().q ? NOTE_SORTS : NOTE_SORTS.filter((sort) => sort.value !== 'updatedAt:desc'),
  );
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
    this.changed.emit({ sort: (value || null) as NoteSort | null });
  }
}
