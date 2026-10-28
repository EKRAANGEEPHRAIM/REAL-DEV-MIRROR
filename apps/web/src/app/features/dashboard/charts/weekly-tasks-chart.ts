import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { WeekCount } from '@devmirror/api-client';
import { plural } from '../dashboard-tiles';
import { elementWidth } from './element-width';
import { formatShortDay, niceTicks } from './chart-math';

const HEIGHT = 200;
const MARGIN = { top: 20, right: 8, bottom: 24, left: 28 };
const MAX_BAR = 24;
const RADIUS = 4;

/** Colonne à bout arrondi (4 px), carrée sur la ligne de base. */
function columnPath(x: number, y: number, width: number, base: number): string {
  const r = Math.min(RADIUS, width / 2, base - y);
  return [
    `M${x},${base}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${base}`,
    'Z',
  ].join(' ');
}

/**
 * Tâches terminées par semaine (12 semaines). Une seule série : une couleur, pas de légende,
 * le titre de la carte dit ce qui est tracé. Seule la semaine courante porte son chiffre ;
 * les autres sont dans l'infobulle et le tableau.
 */
@Component({
  selector: 'dm-weekly-tasks-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div #frame class="relative">
      <svg
        [attr.width]="width()"
        [attr.height]="height"
        role="group"
        [attr.aria-label]="summary()"
        class="block overflow-visible"
      >
        @for (tick of ticks(); track tick) {
          <line
            [attr.x1]="margin.left"
            [attr.x2]="width() - margin.right"
            [attr.y1]="y(tick)"
            [attr.y2]="y(tick)"
            [attr.stroke]="tick === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'"
            stroke-width="1"
            shape-rendering="crispEdges"
          />
          <text
            [attr.x]="margin.left - 6"
            [attr.y]="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-muted-foreground text-[10px] tabular-nums"
          >
            {{ tick }}
          </text>
        }

        @for (bar of bars(); track bar.weekStart) {
          @if (bar.count > 0) {
            <path
              [attr.d]="bar.path"
              fill="var(--viz-series)"
              class="transition-opacity"
              [attr.opacity]="active() !== null && active() !== $index ? 0.55 : 1"
            />
          }
          @if (bar.label) {
            <text
              [attr.x]="bar.center"
              [attr.y]="height - 6"
              text-anchor="middle"
              class="fill-muted-foreground text-[10px]"
            >
              {{ bar.label }}
            </text>
          }
        }

        @if (current(); as bar) {
          <text
            [attr.x]="bar.center"
            [attr.y]="bar.top - 6"
            text-anchor="middle"
            class="fill-foreground text-xs font-medium"
          >
            {{ bar.count }}
          </text>
        }

        <!-- Zones de survol et de focus : toute la hauteur de la bande, pas seulement la barre -->
        @for (bar of bars(); track bar.weekStart) {
          <rect
            [attr.x]="bar.bandX"
            [attr.y]="margin.top"
            [attr.width]="bar.bandWidth"
            [attr.height]="plotHeight"
            fill="transparent"
            tabindex="0"
            role="img"
            class="cursor-default outline-none focus-visible:stroke-[var(--ring)] focus-visible:stroke-2"
            [attr.aria-label]="bar.description"
            (mouseenter)="active.set($index)"
            (mouseleave)="active.set(null)"
            (focus)="active.set($index)"
            (blur)="active.set(null)"
          />
        }
      </svg>

      @if (tooltip(); as tip) {
        <div
          class="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          [style.left.px]="tip.x"
          [style.top.px]="tip.y"
          aria-hidden="true"
        >
          <strong class="block text-sm font-semibold">{{ tip.value }}</strong>
          <span class="text-muted-foreground">{{ tip.label }}</span>
        </div>
      }
    </div>
  `,
})
export class WeeklyTasksChart {
  readonly weeks = input.required<readonly WeekCount[]>();

  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  protected readonly width = elementWidth(this.frame, 560);
  protected readonly height = HEIGHT;
  protected readonly margin = MARGIN;
  protected readonly plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  protected readonly active = signal<number | null>(null);

  protected readonly ticks = computed(() =>
    niceTicks(Math.max(0, ...this.weeks().map((week) => week.count))),
  );

  protected y(value: number): number {
    const top = this.ticks().at(-1) ?? 1;
    return MARGIN.top + this.plotHeight * (1 - value / top);
  }

  protected readonly bars = computed(() => {
    const weeks = this.weeks();
    const plotWidth = this.width() - MARGIN.left - MARGIN.right;
    const band = plotWidth / Math.max(1, weeks.length);
    const barWidth = Math.min(MAX_BAR, band * 0.6);
    const base = this.y(0);
    // Une étiquette toutes les 3 semaines au plus, et toujours la semaine courante.
    const labelEvery = band < 30 ? 4 : 3;

    return weeks.map((week, index) => {
      const bandX = MARGIN.left + index * band;
      const x = bandX + (band - barWidth) / 2;
      const top = this.y(week.count);
      const isLast = index === weeks.length - 1;
      const showLabel = isLast || (index % labelEvery === 0 && weeks.length - 1 - index >= 2);
      const count = `${week.count} ${plural(week.count, 'tâche terminée', 'tâches terminées')}`;
      return {
        ...week,
        bandX,
        bandWidth: band,
        center: bandX + band / 2,
        top,
        path: columnPath(x, top, barWidth, base),
        label: showLabel ? (isLast ? 'Cette sem.' : formatShortDay(week.weekStart)) : '',
        countLabel: count,
        description: `Semaine du ${formatShortDay(week.weekStart)} : ${count}`,
      };
    });
  });

  protected readonly current = computed(() => {
    const last = this.bars().at(-1);
    return last && last.count > 0 ? last : null;
  });

  protected readonly summary = computed(() => {
    const total = this.weeks().reduce((sum, week) => sum + week.count, 0);
    return `Tâches terminées par semaine, ${this.weeks().length} dernières semaines : ${total} au total`;
  });

  protected readonly tooltip = computed(() => {
    const index = this.active();
    if (index === null) return null;
    const bar = this.bars()[index];
    if (!bar) return null;
    const half = 70;
    return {
      x: Math.min(Math.max(bar.center, half), this.width() - half),
      y: Math.min(bar.top, this.y(0)) - 8,
      value: bar.countLabel,
      label: `Semaine du ${formatShortDay(bar.weekStart)}`,
    };
  });
}
