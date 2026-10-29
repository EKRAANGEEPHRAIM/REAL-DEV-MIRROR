import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Task, TaskStatus } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideEllipsisVertical, lucideListChecks } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { translate } from '../../../core/i18n/translate';
import { DUE_TONES, dueLabel } from '../task-dates';
import { TASK_STATUSES, taskPriority } from '../task-meta';

/** Carte du Kanban : ouvre la tâche au clic ; le menu offre une alternative au glisser-déposer. */
@Component({
  selector: 'dm-kanban-card',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideCalendar, lucideEllipsisVertical, lucideListChecks })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let item = task();
    <article
      class="bg-card hover:border-foreground/20 flex flex-col gap-2 rounded-lg border p-3 shadow-xs transition-colors"
      [class.border-destructive/40]="due()?.tone === 'overdue'"
    >
      <div class="flex items-start justify-between gap-2">
        <button
          type="button"
          class="text-left text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          [class.line-through]="item.status === 'DONE'"
          [class.text-muted-foreground]="item.status === 'DONE'"
          (click)="opened.emit(item)"
        >
          {{ item.title }}
        </button>
        <button
          type="button"
          hlmBtn
          variant="ghost"
          size="icon-sm"
          class="-me-1 -mt-1 shrink-0"
          [hlmDropdownMenuTrigger]="menu"
          align="end"
          [attr.aria-label]="t('tasks.board.moveTask', { title: item.title })"
        >
          <ng-icon name="lucideEllipsisVertical" aria-hidden="true" />
        </button>
      </div>

      <div class="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        <span class="rounded-full px-1.5 py-0.5 font-medium" [class]="priority().tone">{{
          t(priority().label)
        }}</span>
        @if (due(); as d) {
          <span class="flex items-center gap-1" [class]="dueTone()">
            <ng-icon name="lucideCalendar" aria-hidden="true" />
            {{ d.label }}
          </span>
        }
        @if (item.subtasks.length) {
          <span class="flex items-center gap-1">
            <ng-icon name="lucideListChecks" aria-hidden="true" />
            {{ subtasksDone() }}/{{ item.subtasks.length }}
          </span>
        }
      </div>

      @if (showProject() && item.project; as project) {
        <span class="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            class="size-2 rounded-full"
            [style.background-color]="project.color ?? 'var(--muted-foreground)'"
            aria-hidden="true"
          ></span>
          {{ project.name }}
        </span>
      }
    </article>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-44">
        <div hlmDropdownMenuLabel>{{ t('tasks.board.moveTo') }}</div>
        @for (status of targets(); track status.value) {
          <button hlmDropdownMenuItem (triggered)="moved.emit(status.value)">
            {{ t(status.label) }}
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class KanbanCard {
  readonly task = input.required<Task>();
  /** Masqué sur le tableau d'un projet (le projet est déjà connu). */
  readonly showProject = input(true);
  readonly opened = output<Task>();
  readonly moved = output<TaskStatus>();
  protected readonly t = translate;

  protected readonly priority = computed(() => taskPriority(this.task().priority));
  protected readonly due = computed(() => {
    const task = this.task();
    return task.dueDate ? dueLabel(task.dueDate, task.status === 'DONE') : null;
  });
  protected readonly dueTone = computed(() => DUE_TONES[this.due()?.tone ?? 'later']);
  protected readonly subtasksDone = computed(
    () => this.task().subtasks.filter((s) => s.done).length,
  );
  protected readonly targets = computed(() =>
    TASK_STATUSES.filter((status) => status.value !== this.task().status),
  );
}
