import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Task } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideListChecks } from '@ng-icons/lucide';
import { translate } from '../../../core/i18n/translate';
import { DUE_TONES, dueLabel } from '../task-dates';
import { taskPriority } from '../task-meta';

@Component({
  selector: 'dm-task-row',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideCalendar, lucideListChecks })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let item = task();
    <div
      class="hover:bg-muted/50 flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors"
      [class.border-destructive/40]="due()?.tone === 'overdue'"
      [class.bg-destructive/5]="due()?.tone === 'overdue'"
    >
      <input
        type="checkbox"
        class="accent-primary mt-1 size-4 shrink-0"
        [checked]="done()"
        [attr.aria-label]="
          t(done() ? 'tasks.row.reopen' : 'tasks.row.complete', { title: item.title })
        "
        (change)="toggled.emit(item)"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          class="text-left text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          [class.line-through]="done()"
          [class.text-muted-foreground]="done()"
          (click)="opened.emit(item)"
        >
          {{ item.title }}
        </button>
        <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span class="rounded-full px-1.5 py-0.5 font-medium" [class]="priority().tone">{{
            t(priority().label)
          }}</span>
          @if (item.project; as project) {
            <a
              [routerLink]="['/projects', project.id]"
              class="hover:text-foreground flex items-center gap-1.5"
            >
              <span
                class="size-2 rounded-full"
                [style.background-color]="project.color ?? 'var(--muted-foreground)'"
                aria-hidden="true"
              ></span>
              {{ project.name }}
            </a>
          }
          @if (due(); as d) {
            <span class="flex items-center gap-1" [class]="dueTone()">
              <ng-icon name="lucideCalendar" aria-hidden="true" />
              {{ d.label }}
            </span>
          }
          @if (item.subtasks.length) {
            <span
              class="flex items-center gap-1"
              [attr.aria-label]="
                t('tasks.row.checklist', { done: subtasksDone(), count: item.subtasks.length })
              "
            >
              <ng-icon name="lucideListChecks" aria-hidden="true" />
              {{ subtasksDone() }}/{{ item.subtasks.length }}
            </span>
          }
        </div>
      </div>
    </div>
  `,
})
export class TaskRow {
  readonly task = input.required<Task>();
  readonly toggled = output<Task>();
  readonly opened = output<Task>();
  protected readonly t = translate;

  protected readonly done = computed(() => this.task().status === 'DONE');
  protected readonly priority = computed(() => taskPriority(this.task().priority));
  protected readonly due = computed(() => {
    const dueDate = this.task().dueDate;
    return dueDate ? dueLabel(dueDate, this.done()) : null;
  });
  protected readonly dueTone = computed(() => DUE_TONES[this.due()?.tone ?? 'later']);
  protected readonly subtasksDone = computed(
    () => this.task().subtasks.filter((s) => s.done).length,
  );
}
