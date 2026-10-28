import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { AuthStore } from '../../core/auth/auth.store';
import { FormAlert } from '../../shared/ui-kit/form-alert';
import { DashboardStore } from './data/dashboard.store';
import { DashboardTile } from './dashboard-tile';
import { firstName, greeting, plural } from './dashboard-tiles';

const dateFormatter = new Intl.DateTimeFormat('fr', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Component({
  selector: 'dm-dashboard-page',
  imports: [
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    DashboardTile,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ title() }}</h1>
        <p class="text-muted-foreground mt-1 text-sm first-letter:uppercase">{{ today }}</p>
      </div>
      <button
        hlmBtn
        variant="outline"
        size="sm"
        [disabled]="store.status() === 'loading'"
        (click)="store.load()"
      >
        <ng-icon
          name="lucideRefreshCw"
          [class]="store.isRefreshing() ? 'motion-safe:animate-spin' : ''"
          aria-hidden="true"
        />
        Actualiser
      </button>
    </header>

    @if (store.status() === 'error' && !store.overview()) {
      <div class="flex max-w-xl flex-col items-start gap-3">
        <dm-form-alert>{{ store.error() }}</dm-form-alert>
        <button hlmBtn variant="outline" (click)="store.load()">
          <ng-icon name="lucideRefreshCw" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    } @else if (store.isInitialLoading()) {
      <div
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Chargement du tableau de bord"
      >
        @for (i of skeletons; track i) {
          <div hlmCard class="gap-3 p-5">
            <hlm-skeleton class="h-4 w-2/3" />
            <hlm-skeleton class="h-8 w-1/3" />
            <hlm-skeleton class="h-3 w-3/4" />
          </div>
        }
      </div>
    } @else if (store.overview()) {
      @if (store.overdueTasks(); as overdue) {
        <a
          routerLink="/tasks"
          [queryParams]="{ due: 'overdue' }"
          class="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
        >
          <ng-icon name="lucideTriangleAlert" class="shrink-0" aria-hidden="true" />
          {{ overdue }} {{ overdueLabel() }} — voir la liste
        </a>
      }
      <section
        aria-label="Indicateurs"
        class="grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4"
        [class.opacity-60]="store.isRefreshing()"
        [attr.aria-busy]="store.isRefreshing()"
      >
        @for (tile of store.tiles(); track tile.id) {
          <dm-dashboard-tile [tile]="tile" />
        }
      </section>
    }
  `,
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);
  private readonly auth = inject(AuthStore);

  protected readonly title = computed(() => {
    const name = firstName(this.auth.user()?.name);
    return name ? `${greeting()}, ${name}` : greeting();
  });
  protected readonly today = dateFormatter.format(new Date());
  protected readonly overdueLabel = computed(() =>
    plural(this.store.overdueTasks(), 'tâche en retard', 'tâches en retard'),
  );
  protected readonly skeletons = [1, 2, 3, 4];

  constructor() {
    this.store.load();
  }
}
