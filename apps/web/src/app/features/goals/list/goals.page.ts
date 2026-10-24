import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Goal } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw, lucideSearchX, lucideTarget } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { Pagination } from '../../../shared/ui-kit/pagination';
import { pageFromUrl } from '../../projects/project-filters';
import { GoalsStore } from '../data/goals.store';
import { GoalDialogs } from '../form/goal-dialogs';
import {
  filtersFromUrl,
  filtersToUrl,
  type GoalFilters,
  hasActiveFilters,
  toApiQuery,
} from '../goal-filters';
import { GoalCard } from './goal-card';
import { GoalFiltersBar } from './goal-filters-bar';

@Component({
  selector: 'dm-goals-page',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    Pagination,
    GoalCard,
    GoalFiltersBar,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw, lucideSearchX, lucideTarget })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        Objectifs
        @if (store.status() === 'loaded') {
          <span class="text-muted-foreground ms-1 text-base font-normal"
            >({{ store.total() }})</span
          >
        }
      </h1>
      <button hlmBtn (click)="create()">
        <ng-icon name="lucidePlus" aria-hidden="true" />
        Nouvel objectif
      </button>
    </header>

    <dm-goal-filters-bar
      class="mb-6 block"
      [value]="filters()"
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
        aria-label="Chargement des objectifs"
      >
        @for (i of skeletons; track i) {
          <div hlmCard class="gap-4">
            <div hlmCardHeader class="gap-2">
              <hlm-skeleton class="h-5 w-2/3" />
              <hlm-skeleton class="h-4 w-1/3" />
            </div>
            <div hlmCardContent class="flex flex-col gap-3">
              <hlm-skeleton class="h-1.5 w-full" />
              <hlm-skeleton class="h-4 w-3/4" />
              <hlm-skeleton class="h-4 w-1/2" />
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
          <h2 class="text-lg font-medium">Aucun objectif ne correspond</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            Essayez un autre état ou une autre recherche.
          </p>
          <button hlmBtn variant="outline" (click)="resetFilters()">
            Réinitialiser les filtres
          </button>
        } @else {
          <ng-icon name="lucideTarget" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h2 class="text-lg font-medium">Aucun objectif pour l’instant</h2>
          <p class="text-muted-foreground max-w-sm text-sm">
            Fixez-vous un cap — une mission, une certification, un lancement — et découpez-le en
            jalons à cocher.
          </p>
          <button hlmBtn (click)="create()">
            <ng-icon name="lucidePlus" aria-hidden="true" />
            Créer un objectif
          </button>
        }
      </section>
    } @else {
      <div
        class="grid items-start gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @for (goal of store.entities(); track goal.id) {
          <dm-goal-card
            [goal]="goal"
            (milestoneToggled)="store.toggleMilestone($event)"
            (editRequested)="edit($event)"
          />
        }
      </div>

      @if (store.meta(); as meta) {
        @if (meta.totalPages > 1) {
          <dm-pagination
            class="mt-6 block"
            [page]="meta.page"
            [totalPages]="meta.totalPages"
            [total]="meta.total"
            itemLabel="objectif"
            itemsLabel="objectifs"
            (pageChange)="goToPage($event)"
          />
        }
      }
    }
  `,
})
export class GoalsPage {
  // Paramètres d'URL liés par withComponentInputBinding (?state=…&q=…&sort=…&page=…)
  readonly state = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly store = inject(GoalsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly dialogs = inject(GoalDialogs);

  protected readonly filters = computed(() =>
    filtersFromUrl({ state: this.state(), q: this.q(), sort: this.sort() }),
  );
  protected readonly filtered = computed(() => hasActiveFilters(this.filters()));
  private readonly query = computed(() => toApiQuery(this.filters(), pageFromUrl(this.page())));
  protected readonly skeletons = [1, 2, 3];

  constructor() {
    this.store.load(this.query);
  }

  protected updateFilters(change: Partial<GoalFilters>): void {
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
    this.dialogs.open().subscribe((result) => {
      if (result?.type !== 'saved') return;
      toast.success(`Objectif « ${result.goal.title} » créé`);
      this.store.reload();
    });
  }

  protected edit(goal: Goal): void {
    this.dialogs.open(goal).subscribe((result) => {
      if (!result) return;
      if (result.type === 'saved') {
        this.store.upsert(result.goal);
        toast.success('Objectif enregistré');
      } else if (result.type === 'deleted') {
        toast.success(`Objectif « ${goal.title} » supprimé`);
        this.store.reload();
      } else {
        this.store.reload();
      }
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
