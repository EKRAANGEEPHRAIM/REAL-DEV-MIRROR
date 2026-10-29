import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideFlame,
  lucideFolderKanban,
  lucideSquareCheckBig,
  lucideTarget,
} from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import type { DashboardTile as Tile } from './dashboard-tiles';

const TONES = {
  default: 'text-muted-foreground',
  positive: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
} as const;

/** Tuile d'indicateur ; cliquable vers la liste correspondante quand elle a un lien. */
@Component({
  selector: 'dm-dashboard-tile',
  imports: [RouterLink, NgIcon, HlmCardImports],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideFlame,
      lucideFolderKanban,
      lucideSquareCheckBig,
      lucideTarget,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let t = tile();
    <article
      hlmCard
      [class]="
        'relative h-full gap-2 p-5 transition-colors' +
        (t.link ? ' hover:border-foreground/20' : '')
      "
    >
      <div class="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <h2 class="font-medium">
          @if (t.link) {
            <!-- Lien étendu à toute la tuile (::after) -->
            <a
              [routerLink]="t.link.commands"
              [queryParams]="t.link.queryParams"
              class="after:absolute after:inset-0 focus-visible:outline-none"
              >{{ t.label }}</a
            >
          } @else {
            {{ t.label }}
          }
        </h2>
        <ng-icon
          [name]="t.icon"
          class="shrink-0 text-lg"
          [class.text-orange-500]="t.id === 'streak' && t.value > 0"
          aria-hidden="true"
        />
      </div>
      <p class="flex items-baseline gap-1.5">
        <span class="text-3xl font-semibold tracking-tight tabular-nums">{{ t.value }}</span>
        @if (t.unit) {
          <span class="text-muted-foreground text-sm">{{ t.unit }}</span>
        }
      </p>
      <p class="text-xs" [class]="toneClass()">{{ t.detail }}</p>
    </article>
  `,
})
export class DashboardTile {
  readonly tile = input.required<Tile>();
  protected readonly toneClass = computed(() => TONES[this.tile().tone]);
}
