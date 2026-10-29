import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideNotebookPen,
  lucidePlus,
  lucideRefreshCw,
  lucideSearchX,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { catchError, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { TagsApi } from '../../../shared/data/tags.api';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { Pagination } from '../../../shared/ui-kit/pagination';
import { pageFromUrl } from '../../projects/project-filters';
import { NotesApi } from '../data/notes.api';
import { NotesStore } from '../data/notes.store';
import { untitledNote } from '../note-defaults';
import {
  filtersFromUrl,
  filtersToUrl,
  hasActiveFilters,
  type NoteFilters,
  toApiQuery,
} from '../note-filters';
import { NoteCard } from './note-card';
import { NoteFiltersBar } from './note-filters-bar';
import { translate } from '../../../core/i18n/translate';

@Component({
  selector: 'dm-notes-page',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    Pagination,
    NoteCard,
    NoteFiltersBar,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucideNotebookPen, lucidePlus, lucideRefreshCw, lucideSearchX }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ t('titles.notes') }}
        @if (store.status() === 'loaded') {
          <span class="text-muted-foreground ms-1 text-base font-normal"
            >({{ store.total() }})</span
          >
        }
      </h1>
      <button hlmBtn [disabled]="creating()" (click)="create()">
        @if (creating()) {
          <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
        } @else {
          <ng-icon name="lucidePlus" aria-hidden="true" />
        }
        {{ t('notes.new') }}
      </button>
    </header>

    <dm-note-filters-bar
      class="mb-6 block"
      [value]="filters()"
      [tags]="noteTags()"
      [active]="filtered()"
      (changed)="updateFilters($event)"
      (cleared)="resetFilters()"
    />

    @if (store.status() === 'error' && !store.entities().length) {
      <div class="flex max-w-xl flex-col items-start gap-3">
        <dm-form-alert>{{ store.error() }}</dm-form-alert>
        <button hlmBtn variant="outline" (click)="reload()">
          <ng-icon name="lucideRefreshCw" aria-hidden="true" />
          {{ t('common.retry') }}
        </button>
      </div>
    } @else if (store.isInitialLoading()) {
      <div
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        [attr.aria-label]="t('notes.loading')"
      >
        @for (i of skeletons; track i) {
          <div hlmCard class="gap-3 p-5">
            <hlm-skeleton class="h-5 w-2/3" />
            <hlm-skeleton class="h-4 w-full" />
            <hlm-skeleton class="h-4 w-4/5" />
          </div>
        }
      </div>
    } @else if (store.isEmpty()) {
      <section
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
      >
        @if (filtered()) {
          <ng-icon name="lucideSearchX" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h2 class="text-lg font-medium">{{ t('notes.empty.filteredTitle') }}</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            {{ t('notes.empty.filteredText') }}
          </p>
          <button hlmBtn variant="outline" (click)="resetFilters()">
            {{ t('common.resetFilters') }}
          </button>
        } @else {
          <ng-icon
            name="lucideNotebookPen"
            class="text-muted-foreground text-4xl"
            aria-hidden="true"
          />
          <h2 class="text-lg font-medium">{{ t('notes.empty.title') }}</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            {{ t('notes.empty.text') }}
          </p>
          <button hlmBtn (click)="create()">
            <ng-icon name="lucidePlus" aria-hidden="true" />
            {{ t('notes.empty.cta') }}
          </button>
        }
      </section>
    } @else {
      <div
        class="flex flex-col gap-8 transition-opacity"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @if (store.pinned().length) {
          <section aria-labelledby="pinned-heading">
            <h2
              id="pinned-heading"
              class="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase"
            >
              {{ t('notes.list.pinned') }}
            </h2>
            <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              @for (note of store.pinned(); track note.id) {
                <li>
                  <dm-note-card
                    [note]="note"
                    (pinToggled)="store.togglePin($event)"
                    (tagSelected)="updateFilters({ tag: $event })"
                  />
                </li>
              }
            </ul>
          </section>
        }
        @if (store.others().length) {
          <section aria-labelledby="others-heading">
            @if (store.pinned().length) {
              <h2
                id="others-heading"
                class="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase"
              >
                {{ t('notes.list.others') }}
              </h2>
            } @else {
              <h2 id="others-heading" class="sr-only">{{ t('titles.notes') }}</h2>
            }
            <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              @for (note of store.others(); track note.id) {
                <li>
                  <dm-note-card
                    [note]="note"
                    (pinToggled)="store.togglePin($event)"
                    (tagSelected)="updateFilters({ tag: $event })"
                  />
                </li>
              }
            </ul>
          </section>
        }
      </div>

      @if (store.meta(); as meta) {
        @if (meta.totalPages > 1) {
          <dm-pagination
            class="mt-6 block"
            [page]="meta.page"
            [totalPages]="meta.totalPages"
            [total]="meta.total"
            unit="notes.count"
            (pageChange)="goToPage($event)"
          />
        }
      }
    }
  `,
})
export class NotesPage {
  protected readonly t = translate;
  // Paramètres d'URL liés par withComponentInputBinding (?q=…&tag=…&sort=…&page=…)
  readonly q = input<string>();
  readonly tag = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly store = inject(NotesStore);
  private readonly api = inject(NotesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);

  protected readonly filters = computed(() =>
    filtersFromUrl({ q: this.q(), tag: this.tag(), sort: this.sort() }),
  );
  protected readonly filtered = computed(() => hasActiveFilters(this.filters()));
  private readonly query = computed(() => toApiQuery(this.filters(), pageFromUrl(this.page())));

  /** Seuls les tags portés par au moins une note servent de filtre (plus le tag actif). */
  protected readonly noteTags = computed(() =>
    this.tags().filter((tag) => tag.usage.notes > 0 || tag.name === this.filters().tag),
  );
  private readonly tags = toSignal(
    inject(TagsApi)
      .list()
      .pipe(catchError(() => of([] as Tag[]))),
    { initialValue: [] as Tag[] },
  );

  protected readonly creating = signal(false);
  protected readonly skeletons = [1, 2, 3];

  constructor() {
    this.store.load(this.query);
  }

  /** Crée une note vide puis ouvre l'éditeur, où tout s'enregistre au fil de la frappe. */
  protected create(): void {
    this.creating.set(true);
    this.api.create({ title: untitledNote() }).subscribe({
      next: (note) => void this.router.navigate(['/notes', note.id]),
      error: (error: unknown) => {
        this.creating.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  protected updateFilters(change: Partial<NoteFilters>): void {
    this.navigate({ ...filtersToUrl(change), page: null });
  }

  protected resetFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected goToPage(page: number): void {
    this.navigate({ page: page > 1 ? String(page) : null });
    this.scroller.scrollToPosition([0, 0]);
  }

  protected reload(): void {
    this.store.load(this.query());
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
