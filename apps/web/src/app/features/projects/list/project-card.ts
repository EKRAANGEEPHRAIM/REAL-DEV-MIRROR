import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Project } from '@devmirror/api-client';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { projectStatus } from '../project-status';
import { translate } from '../../../core/i18n/translate';

const MAX_TECHS = 4;

@Component({
  selector: 'dm-project-card',
  imports: [RouterLink, HlmBadgeImports, HlmCardImports, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = project();
    <article hlmCard class="hover:border-foreground/20 relative h-full gap-4 transition-colors">
      <div hlmCardHeader class="gap-2">
        <div class="flex items-start justify-between gap-3">
          <h2 hlmCardTitle class="flex min-w-0 items-center gap-2 text-base">
            <span
              class="size-2.5 shrink-0 rounded-full"
              [style.background-color]="p.color ?? 'var(--muted-foreground)'"
              aria-hidden="true"
            ></span>
            <!-- Lien étendu à toute la carte (::after), le reste du contenu reste sélectionnable -->
            <a
              [routerLink]="['/projects', p.id]"
              class="truncate after:absolute after:inset-0 focus-visible:outline-none"
            >
              {{ p.name }}
            </a>
          </h2>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            [class]="status().tone"
          >
            {{ t(status().label) }}
          </span>
        </div>
        @if (p.description) {
          <p hlmCardDescription class="line-clamp-2">{{ p.description }}</p>
        }
      </div>

      <div hlmCardContent class="flex flex-col gap-3">
        @if (p.techStack.length || p.tags.length) {
          <div class="flex flex-wrap gap-1.5">
            @for (tech of techs(); track tech) {
              <span hlmBadge variant="secondary">{{ tech }}</span>
            }
            @if (hiddenTechs() > 0) {
              <span hlmBadge variant="outline">+{{ hiddenTechs() }}</span>
            }
            @for (tag of p.tags; track tag.id) {
              <span hlmBadge variant="outline" [style.border-color]="tag.color"
                >#{{ tag.name }}</span
              >
            }
          </div>
        }

        <div class="flex flex-col gap-1.5">
          <div class="text-muted-foreground flex justify-between text-xs">
            <span>
              @if (p.progress.total) {
                {{ t('projects.card.tasks', { done: p.progress.done, count: p.progress.total }) }}
              } @else {
                {{ t('projects.card.noTasks') }}
              }
            </span>
            <span>{{ p.progress.percent }} %</span>
          </div>
          <div
            class="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            [attr.aria-valuenow]="p.progress.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="t('common.progressOf', { name: p.name })"
          >
            <div
              class="bg-primary h-full rounded-full transition-all"
              [style.width.%]="p.progress.percent"
            ></div>
          </div>
        </div>
      </div>

      <p hlmCardFooter class="text-muted-foreground mt-auto text-xs">
        {{ t('projects.card.updated', { when: (p.updatedAt | relativeTime) }) }}
      </p>
    </article>
  `,
})
export class ProjectCard {
  protected readonly t = translate;
  readonly project = input.required<Project>();
  protected readonly status = computed(() => projectStatus(this.project().status));
  protected readonly techs = computed(() => this.project().techStack.slice(0, MAX_TECHS));
  protected readonly hiddenTechs = computed(() =>
    Math.max(0, this.project().techStack.length - MAX_TECHS),
  );
}
