import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFolderKanban, lucidePlus, lucideRefreshCw, lucideSearchX } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { catchError, of } from 'rxjs';
import { TagsApi } from '../../../shared/data/tags.api';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { Pagination } from '../../../shared/ui-kit/pagination';
import { ProjectsStore } from '../data/projects.store';
import { ProjectDialogs } from '../form/project-dialogs';
import {
  filtersFromUrl,
  filtersToUrl,
  hasActiveFilters,
  pageFromUrl,
  type ProjectFilters,
  toApiQuery,
} from '../project-filters';
import { ProjectCard } from './project-card';
import { ProjectFiltersBar } from './project-filters-bar';

@Component({
  selector: 'dm-projects-page',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    Pagination,
    ProjectCard,
    ProjectFiltersBar,
  ],
  providers: [provideIcons({ lucideFolderKanban, lucidePlus, lucideRefreshCw, lucideSearchX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        Projets
        @if (store.status() === 'loaded') {
          <span class="text-muted-foreground ms-1 text-base font-normal"
            >({{ store.total() }})</span
          >
        }
      </h1>
      <button hlmBtn (click)="create()">
        <ng-icon name="lucidePlus" aria-hidden="true" />
        Nouveau projet
      </button>
    </header>

    <dm-project-filters-bar
      class="mb-6 block"
      [value]="filters()"
      [tags]="tags()"
      [active]="filtered()"
      (changed)="updateFilters($event)"
      (cleared)="resetFilters()"
    />

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
        aria-label="Chargement des projets"
      >
        @for (i of skeletons; track i) {
          <div hlmCard class="gap-4">
            <div hlmCardHeader class="gap-2">
              <hlm-skeleton class="h-5 w-2/3" />
              <hlm-skeleton class="h-4 w-full" />
            </div>
            <div hlmCardContent class="flex flex-col gap-3">
              <hlm-skeleton class="h-5 w-1/2" />
              <hlm-skeleton class="h-1.5 w-full" />
            </div>
          </div>
        }
      </div>
    } @else if (store.isEmpty()) {
      <section
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
      >
        @if (filtered()) {
          <ng-icon name="lucideSearchX" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h2 class="text-lg font-medium">Aucun projet ne correspond</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            Essayez d’autres filtres ou une autre recherche.
          </p>
          <button hlmBtn variant="outline" (click)="resetFilters()">
            Réinitialiser les filtres
          </button>
        } @else {
          <ng-icon
            name="lucideFolderKanban"
            class="text-muted-foreground text-4xl"
            aria-hidden="true"
          />
          <h2 class="text-lg font-medium">Aucun projet pour l’instant</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            Créez votre premier projet pour suivre ses tâches, ses notes et sa progression.
          </p>
          <button hlmBtn (click)="create()">
            <ng-icon name="lucidePlus" aria-hidden="true" />
            Créer un projet
          </button>
        }
      </section>
    } @else {
      <div
        class="grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @for (project of store.entities(); track project.id) {
          <dm-project-card [project]="project" />
        }
      </div>

      @if (store.meta(); as meta) {
        @if (meta.totalPages > 1) {
          <dm-pagination
            class="mt-6 block"
            [page]="meta.page"
            [totalPages]="meta.totalPages"
            [total]="meta.total"
            itemLabel="projet"
            itemsLabel="projets"
            (pageChange)="goToPage($event)"
          />
        }
      }
    }
  `,
})
export class ProjectsPage {
  // Paramètres d'URL liés par withComponentInputBinding (?status=…&q=…&page=…)
  readonly status = input<string>();
  readonly q = input<string>();
  readonly tag = input<string>();
  readonly sort = input<string>();
  readonly archived = input<string>();
  readonly page = input<string>();

  protected readonly store = inject(ProjectsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly dialogs = inject(ProjectDialogs);

  protected readonly filters = computed(() =>
    filtersFromUrl({
      status: this.status(),
      q: this.q(),
      tag: this.tag(),
      sort: this.sort(),
      archived: this.archived(),
    }),
  );
  protected readonly filtered = computed(() => hasActiveFilters(this.filters()));
  private readonly query = computed(() => toApiQuery(this.filters(), pageFromUrl(this.page())));

  protected readonly tags = toSignal(
    inject(TagsApi)
      .list()
      .pipe(catchError(() => of([] as Tag[]))),
    {
      initialValue: [] as Tag[],
    },
  );
  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor() {
    // rxMethod sur un signal : rechargement automatique à chaque changement de l'URL.
    this.store.load(this.query);
  }

  protected updateFilters(change: Partial<ProjectFilters>): void {
    // Un nouveau filtre ramène à la première page.
    this.navigate({ ...filtersToUrl(change), page: null });
  }

  protected goToPage(page: number): void {
    this.navigate({ page: page > 1 ? String(page) : null });
    this.scroller.scrollToPosition([0, 0]);
  }

  protected resetFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected create(): void {
    this.dialogs.open().subscribe((project) => {
      toast.success(`Projet « ${project.name} » créé`);
      this.store.reload();
    });
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
