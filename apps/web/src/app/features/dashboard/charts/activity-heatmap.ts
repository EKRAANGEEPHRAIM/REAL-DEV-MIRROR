import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ActivityCalendar } from '@devmirror/api-client';
import { formatDate } from '../../../core/i18n/format';
import { translate } from '../../../core/i18n/translate';
import { buildHeatmap, formatDay, type HeatCell } from './chart-math';

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const TOP = 16;
const LEFT = 30;
/** Lundi, mercredi, vendredi : noms courts dans la langue courante (le 1er janvier 2024 est un lundi). */
function dayLabels(): { row: number; label: string }[] {
  return [0, 2, 4].map((row) => ({
    row,
    label: formatDate(new Date(2024, 0, 1 + row), { weekday: 'short' }),
  }));
}

function describe(cell: HeatCell): string {
  const actions = cell.count
    ? translate('dashboard.activity.actionsCount', { count: cell.count })
    : translate('dashboard.activity.noAction');
  return `${actions} — ${formatDay(cell.date)}`;
}

/**
 * Activité sur 53 semaines : une colonne par semaine, une ligne par jour, rampe séquentielle
 * bleue à une seule teinte (5 classes, gris neutre pour « aucune action »). Au clavier, le
 * conteneur prend le focus et les flèches parcourent les jours ; le jour actif est annoncé.
 */
@Component({
  selector: 'dm-activity-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      #scroller
      class="focus-visible:ring-ring overflow-x-auto rounded-md pb-1 outline-none focus-visible:ring-2"
      tabindex="0"
      [attr.aria-label]="summary()"
      aria-describedby="heatmap-help"
      (keydown)="onKeydown($event)"
      (focus)="focusDefault()"
      (blur)="active.set(null)"
    >
      <div class="relative w-max">
        <svg [attr.width]="width()" [attr.height]="height" aria-hidden="true" class="block">
          @for (month of model().months; track month.column) {
            <text
              [attr.x]="left + month.column * pitch"
              y="10"
              class="fill-muted-foreground text-[10px]"
            >
              {{ month.label }}
            </text>
          }
          @for (day of dayLabels(); track day.row) {
            <text
              [attr.x]="left - 6"
              [attr.y]="top + day.row * pitch + cell / 2"
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-muted-foreground text-[10px]"
            >
              {{ day.label }}
            </text>
          }
          @for (week of model().weeks; track $index; let column = $index) {
            @for (day of week; track day.date; let row = $index) {
              <rect
                [attr.x]="left + column * pitch"
                [attr.y]="top + row * pitch"
                [attr.width]="cell"
                [attr.height]="cell"
                rx="2"
                [attr.fill]="'var(--viz-heat-' + day.level + ')'"
                [attr.stroke]="active() === day.index ? 'var(--foreground)' : 'none'"
                stroke-width="1.5"
                (mouseenter)="active.set(day.index)"
                (mouseleave)="active.set(null)"
              />
            }
          }
        </svg>

        @if (tooltip(); as tip) {
          <div
            class="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
            [style.left.px]="tip.x"
            [style.top.px]="tip.y"
          >
            <strong class="block text-sm font-semibold">{{ tip.value }}</strong>
            <span class="text-muted-foreground">{{ tip.label }}</span>
          </div>
        }
      </div>
    </div>

    <div
      class="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"
    >
      <p id="heatmap-help">{{ t('dashboard.activity.keyboardHelp') }}</p>
      <p class="flex items-center gap-1" aria-hidden="true">
        {{ t('dashboard.activity.less') }}
        @for (level of levels; track level) {
          <span
            class="inline-block size-[11px] rounded-[2px]"
            [style.background-color]="'var(--viz-heat-' + level + ')'"
          ></span>
        }
        {{ t('dashboard.activity.more') }}
      </p>
    </div>
    <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class ActivityHeatmap {
  readonly calendar = input.required<ActivityCalendar>();

  protected readonly cell = CELL;
  protected readonly pitch = PITCH;
  protected readonly top = TOP;
  protected readonly left = LEFT;
  protected readonly height = TOP + 7 * PITCH;
  protected readonly dayLabels = computed(dayLabels);
  protected readonly t = translate;
  protected readonly levels = [0, 1, 2, 3, 4];
  protected readonly active = signal<number | null>(null);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly model = computed(() => buildHeatmap(this.calendar()));
  protected readonly width = computed(() => LEFT + this.model().weeks.length * PITCH);

  protected readonly summary = computed(() => {
    const { total } = this.calendar();
    const activeDays = this.calendar().days.length;
    return translate('dashboard.activity.summary', {
      actions: translate('dashboard.activity.actionsCount', { count: total }),
      days: translate('dashboard.activity.activeDays', { count: activeDays }),
    });
  });

  private readonly position = computed(() => {
    const index = this.active();
    if (index === null) return null;
    const weeks = this.model().weeks;
    for (let column = 0; column < weeks.length; column++) {
      const row = weeks[column].findIndex((day) => day.index === index);
      if (row >= 0) return { column, row, cell: weeks[column][row] };
    }
    return null;
  });

  protected readonly tooltip = computed(() => {
    const position = this.position();
    if (!position) return null;
    const { column, row, cell } = position;
    const label = describe(cell);
    const [value, date] = label.split(' — ');
    return {
      x: Math.min(Math.max(LEFT + column * PITCH + CELL / 2, 80), this.width() - 80),
      y: TOP + row * PITCH - 4,
      value,
      label: date,
    };
  });

  protected readonly announcement = computed(() => {
    const position = this.position();
    return position ? describe(position.cell) : '';
  });

  constructor() {
    // Les semaines récentes sont à droite : on y amène la vue au premier affichage.
    afterNextRender(() => {
      const node = this.scroller()?.nativeElement;
      if (node) node.scrollLeft = node.scrollWidth;
    });
  }

  /** Au focus : aujourd'hui (dernière case), si aucun jour n'est encore actif. */
  protected focusDefault(): void {
    if (this.active() === null) this.active.set(this.model().cells.length - 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.model().cells.length - 1;
    const current = this.active() ?? last;
    const moves: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    };
    let next: number | null = null;
    if (event.key in moves) next = current + moves[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    this.active.set(Math.min(Math.max(next, 0), last));
  }
}
