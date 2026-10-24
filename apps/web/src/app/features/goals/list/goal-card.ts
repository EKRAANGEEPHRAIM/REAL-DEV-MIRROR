import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Goal } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { TARGET_TONES, targetLabel } from '../goal-meta';

/** Jalons visibles avant « Voir les N autres ». */
const VISIBLE_MILESTONES = 5;

@Component({
  selector: 'dm-goal-card',
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmCardImports],
  providers: [provideIcons({ lucidePencil })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let g = goal();
    <article hlmCard class="h-full gap-4" [class.border-emerald-500]="g.completed">
      <div hlmCardHeader class="gap-2">
        <div class="flex items-start justify-between gap-3">
          <h2 hlmCardTitle class="min-w-0 text-base wrap-break-word">{{ g.title }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon-sm"
            class="-me-2 -mt-1 shrink-0"
            [attr.aria-label]="'Modifier « ' + g.title + ' »'"
            (click)="editRequested.emit(g)"
          >
            <ng-icon name="lucidePencil" aria-hidden="true" />
          </button>
        </div>
        @if (target(); as t) {
          <span class="w-fit rounded-full px-2 py-0.5 text-xs font-medium" [class]="tone()">
            {{ t.label }}
          </span>
        }
        @if (g.description) {
          <p hlmCardDescription class="line-clamp-2">{{ g.description }}</p>
        }
      </div>

      <div hlmCardContent class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <div class="text-muted-foreground flex justify-between text-xs">
            <span>
              @if (g.progress.total) {
                {{ g.progress.done }}/{{ g.progress.total }} jalons
              } @else {
                Aucun jalon
              }
            </span>
            <span>{{ g.progress.percent }} %</span>
          </div>
          <div
            class="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            [attr.aria-valuenow]="g.progress.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="'Progression de ' + g.title"
          >
            <div
              class="h-full rounded-full transition-all"
              [class]="g.completed ? 'bg-emerald-500' : 'bg-primary'"
              [style.width.%]="g.progress.percent"
            ></div>
          </div>
        </div>

        @if (g.milestones.length) {
          <ul class="flex flex-col gap-0.5" [attr.aria-label]="'Jalons de ' + g.title">
            @for (milestone of visibleMilestones(); track milestone.id) {
              <li>
                <label
                  class="hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    class="accent-primary mt-0.5 size-4 shrink-0"
                    [checked]="milestone.done"
                    (change)="milestoneToggled.emit({ goalId: g.id, milestoneId: milestone.id })"
                  />
                  <span
                    [class.line-through]="milestone.done"
                    [class.text-muted-foreground]="milestone.done"
                    >{{ milestone.title }}</span
                  >
                </label>
              </li>
            }
          </ul>
          @if (hiddenCount() > 0) {
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground w-fit text-xs underline-offset-2 hover:underline"
              [attr.aria-expanded]="expanded()"
              (click)="expanded.set(!expanded())"
            >
              {{ expanded() ? 'Réduire' : 'Voir les ' + hiddenCount() + ' autres jalons' }}
            </button>
          }
        }
      </div>

      @if (g.projects.length) {
        <div hlmCardFooter class="mt-auto flex flex-wrap gap-1.5">
          @for (project of g.projects; track project.id) {
            <a
              [routerLink]="['/projects', project.id]"
              class="hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
            >
              <span
                class="size-2 rounded-full"
                [style.background-color]="project.color ?? 'var(--muted-foreground)'"
                aria-hidden="true"
              ></span>
              {{ project.name }}
            </a>
          }
        </div>
      }
    </article>
  `,
})
export class GoalCard {
  readonly goal = input.required<Goal>();
  readonly milestoneToggled = output<{ goalId: string; milestoneId: string }>();
  readonly editRequested = output<Goal>();

  protected readonly expanded = signal(false);
  protected readonly target = computed(() => targetLabel(this.goal()));
  protected readonly tone = computed(() => {
    const target = this.target();
    return target ? TARGET_TONES[target.tone] : '';
  });
  protected readonly visibleMilestones = computed(() =>
    this.expanded() ? this.goal().milestones : this.goal().milestones.slice(0, VISIBLE_MILESTONES),
  );
  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.goal().milestones.length - VISIBLE_MILESTONES),
  );
}
