import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Project, Task, TaskPriority, TaskStatus } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucidePlus, lucideTrash2, lucideX } from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { catchError, concatMap, filter, from, map, of, switchMap, toArray } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { ProjectsApi } from '../../projects/data/projects.api';
import { TasksApi } from '../data/tasks.api';
import { fromDateInput, toDateInput } from '../task-dates';
import { TASK_PRIORITIES, TASK_STATUSES } from '../task-meta';
import { translate } from '../../../core/i18n/translate';

export interface TaskFormContext {
  task?: Task;
  /** Projet pré-sélectionné à la création (depuis la page d'un projet). */
  projectId?: string;
  /** Statut initial à la création (bouton « + » d'une colonne du Kanban). */
  status?: TaskStatus;
}

export type TaskDialogResult = { type: 'saved'; task: Task } | { type: 'deleted'; id: string };

interface ChecklistItem {
  /** null tant que la sous-tâche n'est pas enregistrée (création de tâche). */
  id: string | null;
  title: string;
  done: boolean;
}

const FIELD_CLASSES =
  'border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2';

/**
 * Création et modification d'une tâche. En modification, chaque action sur la checklist est
 * enregistrée immédiatement ; en création, les sous-tâches sont créées juste après la tâche.
 */
@Component({
  selector: 'dm-task-form-dialog',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideLoader2, lucidePlus, lucideTrash2, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog-header>
      <h2 hlmDialogTitle>{{ editing ? t('tasks.form.editTitle') : t('tasks.new') }}</h2>
      <p hlmDialogDescription>{{ t('common.required') }}</p>
    </hlm-dialog-header>

    <form
      class="mt-2 flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1"
      [formGroup]="form"
      (ngSubmit)="submit()"
      novalidate
    >
      @if (error(); as message) {
        <dm-form-alert>{{ message }}</dm-form-alert>
      }

      <div class="flex flex-col gap-2">
        <label hlmLabel for="task-title">{{ t('tasks.form.title') }} *</label>
        <input
          hlmInput
          id="task-title"
          formControlName="title"
          maxlength="200"
          [attr.aria-invalid]="titleInvalid()"
          aria-describedby="task-title-error"
        />
        @if (titleInvalid()) {
          <p id="task-title-error" class="text-destructive text-sm">
            {{ t('tasks.form.titleError') }}
          </p>
        }
      </div>

      <div class="flex flex-col gap-2">
        <label hlmLabel for="task-description">{{ t('projects.form.description') }}</label>
        <textarea
          id="task-description"
          rows="3"
          maxlength="5000"
          formControlName="description"
          [class]="fieldClasses"
        ></textarea>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label hlmLabel for="task-status">{{ t('projects.form.status') }}</label>
          <select id="task-status" formControlName="status" [class]="fieldClasses">
            @for (status of statuses; track status.value) {
              <option [value]="status.value">{{ t(status.label) }}</option>
            }
          </select>
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="task-priority">{{ t('tasks.form.priority') }}</label>
          <select id="task-priority" formControlName="priority" [class]="fieldClasses">
            @for (priority of priorities; track priority.value) {
              <option [value]="priority.value">{{ t(priority.label) }}</option>
            }
          </select>
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="task-due">{{ t('tasks.filters.due') }}</label>
          <input hlmInput id="task-due" type="date" formControlName="dueDate" />
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="task-project">{{ t('tasks.filters.project') }}</label>
          <select id="task-project" formControlName="projectId" [class]="fieldClasses">
            <option value="">{{ t('tasks.form.noProject') }}</option>
            @for (project of projects(); track project.id) {
              <option [value]="project.id">{{ project.name }}</option>
            }
          </select>
        </div>
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-medium">
          {{ t('tasks.form.checklist') }}
          @if (checklist().length) {
            <span class="text-muted-foreground font-normal"
              >({{ doneCount() }}/{{ checklist().length }})</span
            >
          }
        </legend>
        <ul class="flex flex-col gap-1">
          @for (item of checklist(); track $index; let i = $index) {
            <li class="group hover:bg-muted/60 flex items-center gap-2 rounded-md px-1 py-1">
              <input
                type="checkbox"
                class="accent-primary size-4"
                [checked]="item.done"
                [attr.aria-label]="t('common.checkItem', { title: item.title })"
                (change)="toggleItem(i)"
              />
              <span
                class="flex-1 text-sm"
                [class.line-through]="item.done"
                [class.text-muted-foreground]="item.done"
                >{{ item.title }}</span
              >
              <button
                type="button"
                hlmBtn
                variant="ghost"
                size="icon-sm"
                [attr.aria-label]="t('common.deleteItem', { title: item.title })"
                (click)="removeItem(i)"
              >
                <ng-icon name="lucideX" aria-hidden="true" />
              </button>
            </li>
          }
        </ul>
        <div class="flex gap-2">
          <label hlmLabel for="new-subtask" class="sr-only">{{ t('tasks.form.newItem') }}</label>
          <input
            hlmInput
            id="new-subtask"
            class="flex-1"
            [placeholder]="t('tasks.form.newItemPlaceholder')"
            maxlength="200"
            [value]="newItem()"
            (input)="newItem.set($any($event.target).value)"
            (keydown.enter)="$event.preventDefault(); addItem()"
          />
          <button
            type="button"
            hlmBtn
            variant="outline"
            [disabled]="!newItem().trim()"
            (click)="addItem()"
          >
            <ng-icon name="lucidePlus" aria-hidden="true" />
            {{ t('common.add') }}
          </button>
        </div>
      </fieldset>

      <hlm-dialog-footer class="bg-background sticky bottom-0 pt-2 sm:justify-between">
        @if (editing) {
          <button hlmBtn type="button" variant="ghost" class="text-destructive" (click)="remove()">
            <ng-icon name="lucideTrash2" aria-hidden="true" />
            {{ t('common.delete') }}
          </button>
        }
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <button hlmBtn type="button" variant="outline" (click)="ref.close()">
            {{ t('common.cancel') }}
          </button>
          <button hlmBtn type="submit" [disabled]="saving()">
            @if (saving()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            }
            {{ editing ? t('common.save') : t('tasks.form.create') }}
          </button>
        </div>
      </hlm-dialog-footer>
    </form>
  `,
})
export class TaskFormDialog {
  protected readonly t = translate;
  protected readonly ref = inject<BrnDialogRef<TaskDialogResult>>(BrnDialogRef);
  private readonly api = inject(TasksApi);
  private readonly confirm = inject(ConfirmService);
  private readonly context = injectBrnDialogContext<TaskFormContext>();
  private readonly task = this.context.task;

  protected readonly editing = !!this.task;
  protected readonly statuses = TASK_STATUSES;
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly fieldClasses = FIELD_CLASSES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [
      this.task?.title ?? '',
      [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)],
    ],
    description: [this.task?.description ?? '', Validators.maxLength(5000)],
    status: [(this.task?.status ?? this.context.status ?? 'TODO') as TaskStatus],
    priority: [(this.task?.priority ?? 'MEDIUM') as TaskPriority],
    dueDate: [toDateInput(this.task?.dueDate)],
    projectId: [this.task?.project?.id ?? this.context.projectId ?? ''],
  });

  protected readonly projects = toSignal(
    inject(ProjectsApi)
      .list({ limit: 100, sort: 'name:asc' })
      .pipe(
        map((page) => page.data),
        catchError(() => of([] as Project[])),
      ),
    { initialValue: [] as Project[] },
  );

  protected readonly checklist = signal<ChecklistItem[]>(
    this.task?.subtasks.map(({ id, title, done }) => ({ id, title, done })) ?? [],
  );
  protected readonly doneCount = computed(
    () => this.checklist().filter((item) => item.done).length,
  );
  protected readonly newItem = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected titleInvalid(): boolean {
    const title = this.form.controls.title;
    return title.invalid && (title.touched || title.dirty);
  }

  protected addItem(): void {
    const title = this.newItem().trim();
    if (!title) return;
    this.newItem.set('');
    if (!this.task) {
      this.checklist.update((items) => [...items, { id: null, title, done: false }]);
      return;
    }
    this.api.addSubtask(this.task.id, { title }).subscribe({
      next: (subtask) =>
        this.checklist.update((items) => [
          ...items,
          { id: subtask.id, title: subtask.title, done: false },
        ]),
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  protected toggleItem(index: number): void {
    const item = this.checklist()[index];
    const done = !item.done;
    this.checklist.update((items) => items.map((it, i) => (i === index ? { ...it, done } : it)));
    if (this.task && item.id) {
      this.api.updateSubtask(this.task.id, item.id, { done }).subscribe({
        error: (error: unknown) => {
          this.checklist.update((items) => items.map((it, i) => (i === index ? item : it)));
          this.error.set(apiErrorMessage(error));
        },
      });
    }
  }

  protected removeItem(index: number): void {
    const item = this.checklist()[index];
    this.checklist.update((items) => items.filter((_, i) => i !== index));
    if (this.task && item.id) {
      this.api.removeSubtask(this.task.id, item.id).subscribe({
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const body = {
      title: value.title.trim(),
      description: value.description.trim() || null,
      status: value.status,
      priority: value.priority,
      dueDate: fromDateInput(value.dueDate),
      projectId: value.projectId || null,
    };

    this.saving.set(true);
    this.error.set(null);
    const request = this.task
      ? this.api.update(this.task.id, body)
      : this.api.create(body).pipe(
          // Création : enregistre la checklist dans l'ordre, puis relit la tâche complète.
          switchMap((created) =>
            from(this.checklist()).pipe(
              concatMap((item) =>
                this.api
                  .addSubtask(created.id, { title: item.title })
                  .pipe(
                    switchMap((subtask) =>
                      item.done
                        ? this.api.updateSubtask(created.id, subtask.id, { done: true })
                        : of(subtask),
                    ),
                  ),
              ),
              toArray(),
              switchMap(() => this.api.get(created.id)),
            ),
          ),
        );

    request.subscribe({
      next: (task) => this.ref.close({ type: 'saved', task }),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  protected remove(): void {
    const task = this.task;
    if (!task) return;
    this.confirm
      .confirm({
        title: translate('common.deleteTitle', { name: task.title }),
        description: translate('tasks.delete.description'),
        confirmLabel: translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(task.id)),
      )
      .subscribe({
        next: () => this.ref.close({ type: 'deleted', id: task.id }),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }
}
