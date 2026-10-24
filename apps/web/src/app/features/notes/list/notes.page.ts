import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader2,
  lucideNotebookPen,
  lucidePin,
  lucidePlus,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { apiErrorMessage } from '../../../core/http/api-error';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { Pagination } from '../../../shared/ui-kit/pagination';
import { pageFromUrl } from '../../projects/project-filters';
import { NotesApi } from '../data/notes.api';
import { NotesStore } from '../data/notes.store';
import { UNTITLED_NOTE } from '../note-defaults';

export const NOTES_PAGE_SIZE = 24;

@Component({
  selector: 'dm-notes-page',
  imports: [
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    Pagination,
    RelativeTimePipe,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucideNotebookPen, lucidePin, lucidePlus, lucideRefreshCw }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        Notes
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
        Nouvelle note
      </button>
    </header>

    @if (store.status() === 'error' && !store.entities().length) {
      <div class="flex max-w-xl flex-col items-start gap-3">
        <dm-form-alert>{{ store.error() }}</dm-form-alert>
        <button hlmBtn variant="outline" (click)="reload()">
          <ng-icon name="lucideRefreshCw" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    } @else if (store.isInitialLoading()) {
      <div
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        aria-label="Chargement des notes"
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
        <ng-icon
          name="lucideNotebookPen"
          class="text-muted-foreground text-4xl"
          aria-hidden="true"
        />
        <h2 class="text-lg font-medium">Aucune note pour l’instant</h2>
        <p class="text-muted-foreground max-w-sm text-sm">
          Gardez une trace de vos décisions, de vos pièges rencontrés et de vos extraits de code, en
          Markdown.
        </p>
        <button hlmBtn (click)="create()">
          <ng-icon name="lucidePlus" aria-hidden="true" />
          Écrire une note
        </button>
      </section>
    } @else {
      <ul
        class="grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @for (note of store.entities(); track note.id) {
          <li>
            <article
              hlmCard
              class="hover:border-foreground/20 relative h-full gap-2 p-5 transition-colors"
            >
              <h2 class="flex items-start gap-2 font-medium">
                @if (note.pinned) {
                  <ng-icon
                    name="lucidePin"
                    class="text-muted-foreground mt-0.5 shrink-0"
                    aria-label="Épinglée"
                  />
                }
                <a
                  [routerLink]="['/notes', note.id]"
                  class="min-w-0 wrap-break-word after:absolute after:inset-0 focus-visible:outline-none"
                  >{{ note.title }}</a
                >
              </h2>
              @if (note.excerpt) {
                <p class="text-muted-foreground line-clamp-3 text-sm">{{ note.excerpt }}</p>
              }
              <p class="text-muted-foreground mt-auto pt-2 text-xs">
                @if (note.project) {
                  {{ note.project.name }} ·
                }
                Modifiée {{ note.updatedAt | relativeTime }}
              </p>
            </article>
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
            itemLabel="note"
            itemsLabel="notes"
            (pageChange)="goToPage($event)"
          />
        }
      }
    }
  `,
})
export class NotesPage {
  readonly page = input<string>();

  protected readonly store = inject(NotesStore);
  private readonly api = inject(NotesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);

  private readonly query = computed(() => ({
    page: pageFromUrl(this.page()),
    limit: NOTES_PAGE_SIZE,
  }));
  protected readonly creating = signal(false);
  protected readonly skeletons = [1, 2, 3];

  constructor() {
    this.store.load(this.query);
  }

  /** Crée une note vide puis ouvre l'éditeur, où tout s'enregistre au fil de la frappe. */
  protected create(): void {
    this.creating.set(true);
    this.api.create({ title: UNTITLED_NOTE }).subscribe({
      next: (note) => void this.router.navigate(['/notes', note.id]),
      error: (error: unknown) => {
        this.creating.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? String(page) : null },
      queryParamsHandling: 'merge',
    });
    this.scroller.scrollToPosition([0, 0]);
  }

  protected reload(): void {
    this.store.load(this.query());
  }
}
