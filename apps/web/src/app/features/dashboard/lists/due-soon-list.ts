import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DueTask } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideCalendarCheck } from '@ng-icons/lucide';
import { DUE_TONES, dueLabel } from '../../tasks/task-dates';
import { taskPriority } from '../../tasks/task-meta';

/** Tâches non terminées dont l'échéance tombe dans les 7 prochains jours, la plus proche d'abord. */
@Component({
  selector: 'dm-due-soon-list',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideCalendar, lucideCalendarCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (rows().length) {
      <ul class="-mx-2 flex flex-col">
        @for (row of rows(); track row.task.id) {
          <li class="hover:bg-muted/50 flex items-start gap-3 rounded-md px-2 py-2">
            <input
              type="checkbox"
              class="accent-primary mt-0.5 size-4 shrink-0"
              [attr.aria-label]="'Terminer « ' + row.task.title + ' »'"
              (change)="completed.emit(row.task)"
            />
            <div class="min-w-0 flex-1">
              <a
                routerLink="/tasks"
                [queryParams]="{ q: row.task.title }"
                class="block truncate text-sm font-medium hover:underline"
                >{{ row.task.title }}</a
              >
              <p class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                <span class="flex items-center gap-1" [class]="row.dueTone">
                  <ng-icon name="lucideCalendar" aria-hidden="true" />
                  {{ row.due }}
                </span>
                <span class="rounded-full px-1.5 py-0.5 font-medium" [class]="row.priority.tone">
                  {{ row.priority.label }}
                </span>
                @if (row.task.project; as project) {
                  <span class="flex min-w-0 items-center gap-1">
                    <span
                      class="size-2 shrink-0 rounded-full"
                      [style.background-color]="project.color ?? 'var(--muted-foreground)'"
                      aria-hidden="true"
                    ></span>
                    <span class="truncate">{{ project.name }}</span>
                  </span>
                }
              </p>
            </div>
          </li>
        }
      </ul>
    } @else {
      <div class="flex flex-col items-center gap-2 py-8 text-center">
        <ng-icon
          name="lucideCalendarCheck"
          class="text-muted-foreground text-3xl"
          aria-hidden="true"
        />
        <p class="text-muted-foreground text-sm">Rien d’urgent : aucune échéance cette semaine.</p>
      </div>
    }
  `,
})
export class DueSoonList {
  readonly tasks = input.required<readonly DueTask[]>();
  readonly completed = output<DueTask>();

  protected readonly rows = computed(() =>
    this.tasks().map((task) => {
      const due = dueLabel(task.dueDate, false);
      return {
        task,
        due: due.label,
        dueTone: DUE_TONES[due.tone],
        priority: taskPriority(task.priority),
      };
    }),
  );
}
