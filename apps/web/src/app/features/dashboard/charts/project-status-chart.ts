import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { StatusCount } from '@devmirror/api-client';
import { projectStatus } from '../../projects/project-status';
import { plural } from '../dashboard-tiles';

/**
 * Projets par statut, en barres horizontales d'une seule couleur : un statut de projet n'est
 * ni bon ni mauvais (pas de couleurs d'état), et les catégories n'ont pas d'ordre de valeur
 * (pas de dégradé). Le nombre est au bout de chaque barre.
 */
@Component({
  selector: 'dm-project-status-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ul class="flex flex-col gap-3" [attr.aria-label]="summary()">
      @for (row of rows(); track row.status) {
        <li
          class="focus-visible:ring-ring relative flex items-center gap-3 rounded text-sm outline-none focus-visible:ring-2"
          tabindex="0"
          [attr.aria-label]="row.description"
          (mouseenter)="active.set(row.status)"
          (mouseleave)="active.set(null)"
          (focus)="active.set(row.status)"
          (blur)="active.set(null)"
        >
          <span class="text-muted-foreground w-22 shrink-0 truncate">{{ row.label }}</span>
          <span class="flex min-w-0 flex-1 items-center gap-2" aria-hidden="true">
            @if (row.count > 0) {
              <span
                class="block h-3 rounded-r-[4px] transition-opacity"
                [style.width.%]="row.width"
                [style.background-color]="'var(--viz-series)'"
                [style.opacity]="active() && active() !== row.status ? 0.55 : 1"
              ></span>
            }
            <span class="text-foreground text-xs font-medium tabular-nums">{{ row.count }}</span>
          </span>
          @if (active() === row.status) {
            <span
              class="bg-popover text-popover-foreground pointer-events-none absolute -top-9 right-0 z-10 rounded-md border px-2.5 py-1 text-xs whitespace-nowrap shadow-md"
              aria-hidden="true"
            >
              <strong class="font-semibold">{{ row.share }} %</strong>
              <span class="text-muted-foreground"> des projets</span>
            </span>
          }
        </li>
      }
    </ul>
  `,
})
export class ProjectStatusChart {
  readonly statuses = input.required<readonly StatusCount[]>();
  protected readonly active = signal<string | null>(null);

  private readonly total = computed(() => this.statuses().reduce((sum, row) => sum + row.count, 0));

  protected readonly rows = computed(() => {
    const max = Math.max(1, ...this.statuses().map((row) => row.count));
    const total = this.total();
    return this.statuses().map((row) => {
      const label = projectStatus(row.status).label;
      const share = total ? Math.round((row.count / total) * 100) : 0;
      return {
        ...row,
        label,
        share,
        // 85 % au plus : la place du nombre au bout de la plus longue barre.
        width: (row.count / max) * 85,
        description: `${label} : ${row.count} ${plural(row.count, 'projet')} (${share} %)`,
      };
    });
  });

  protected readonly summary = computed(
    () => `Projets par statut, ${this.total()} ${plural(this.total(), 'projet')} au total`,
  );
}
