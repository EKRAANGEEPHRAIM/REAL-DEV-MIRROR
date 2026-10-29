import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Goal, Project } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucidePlus, lucideTrash2, lucideX } from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { ProjectsApi } from '../../projects/data/projects.api';
import { fromDateInput, toDateInput } from '../../tasks/task-dates';
import { GoalsApi } from '../data/goals.api';
import { MAX_MILESTONES } from '../goal-meta';
import { translate } from '../../../core/i18n/translate';

export interface GoalFormContext {
  goal?: Goal;
}

/**
 * `changed` : fermeture sans enregistrer alors que des jalons ont été modifiés (ils sont
 * enregistrés au fil de l'eau en modification) ; la liste doit être relue.
 */
export type GoalDialogResult =
  { type: 'saved'; goal: Goal } | { type: 'deleted'; id: string } | { type: 'changed' };

interface MilestoneItem {
  /** null tant que le jalon n'est pas enregistré (création d'objectif). */
  id: string | null;
  title: string;
  done: boolean;
}

const FIELD_CLASSES =
  'border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2';

/**
 * Création et modification d'un objectif. En création, les jalons partent avec l'objectif
 * (une seule requête) ; en modification, chaque action sur un jalon est enregistrée aussitôt.
 */
@Component({
  selector: 'dm-goal-form-dialog',
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
      <h2 hlmDialogTitle>{{ editing ? t('goals.form.editTitle') : t('goals.new') }}</h2>
      <p hlmDialogDescription>
        {{ t('goals.form.subtitle') }}
      </p>
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
        <label hlmLabel for="goal-title">{{ t('tasks.form.title') }} *</label>
        <input
          hlmInput
          id="goal-title"
          formControlName="title"
          maxlength="200"
          [placeholder]="t('goals.form.titlePlaceholder')"
          [attr.aria-invalid]="titleInvalid()"
          aria-describedby="goal-title-error"
        />
        @if (titleInvalid()) {
          <p id="goal-title-error" class="text-destructive text-sm">
            {{ t('tasks.form.titleError') }}
          </p>
        }
      </div>

      <div class="flex flex-col gap-2">
        <label hlmLabel for="goal-description">{{ t('projects.form.description') }}</label>
        <textarea
          id="goal-description"
          rows="2"
          maxlength="2000"
          formControlName="description"
          [class]="fieldClasses"
        ></textarea>
      </div>

      <div class="flex flex-col gap-2 sm:w-1/2">
        <label hlmLabel for="goal-target">{{ t('goals.form.targetDate') }}</label>
        <input hlmInput id="goal-target" type="date" formControlName="targetDate" />
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-medium">
          {{ t('goals.form.milestones') }}
          @if (milestones().length) {
            <span class="text-muted-foreground font-normal"
              >({{ doneCount() }}/{{ milestones().length }})</span
            >
          }
        </legend>
        <ul class="flex flex-col gap-1">
          @for (item of milestones(); track $index; let i = $index) {
            <li class="hover:bg-muted/60 flex items-center gap-2 rounded-md px-1 py-1">
              <input
                type="checkbox"
                class="accent-primary size-4"
                [checked]="item.done"
                [attr.aria-label]="t('common.checkItem', { title: item.title })"
                (change)="toggleMilestone(i)"
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
                (click)="removeMilestone(i)"
              >
                <ng-icon name="lucideX" aria-hidden="true" />
              </button>
            </li>
          }
        </ul>
        @if (milestones().length < maxMilestones) {
          <div class="flex gap-2">
            <label hlmLabel for="new-milestone" class="sr-only">{{
              t('goals.form.newMilestone')
            }}</label>
            <input
              hlmInput
              id="new-milestone"
              class="flex-1"
              [placeholder]="t('goals.form.newMilestonePlaceholder')"
              maxlength="200"
              [value]="newMilestone()"
              (input)="newMilestone.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); addMilestone()"
            />
            <button
              type="button"
              hlmBtn
              variant="outline"
              [disabled]="!newMilestone().trim()"
              (click)="addMilestone()"
            >
              <ng-icon name="lucidePlus" aria-hidden="true" />
              {{ t('common.add') }}
            </button>
          </div>
        } @else {
          <p class="text-muted-foreground text-sm">
            {{ t('goals.form.max', { max: maxMilestones }) }}
          </p>
        }
      </fieldset>

      @if (projects().length) {
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">{{ t('goals.form.projects') }}</legend>
          <div class="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
            @for (project of projects(); track project.id) {
              <label class="hover:bg-muted/60 flex items-center gap-2 rounded px-1 py-1 text-sm">
                <input
                  type="checkbox"
                  class="accent-primary size-4"
                  [checked]="projectIds().has(project.id)"
                  (change)="toggleProject(project.id)"
                />
                <span
                  class="size-2 rounded-full"
                  [style.background-color]="project.color ?? 'var(--muted-foreground)'"
                  aria-hidden="true"
                ></span>
                {{ project.name }}
              </label>
            }
          </div>
        </fieldset>
      }

      <hlm-dialog-footer class="bg-background sticky bottom-0 pt-2 sm:justify-between">
        @if (editing) {
          <button hlmBtn type="button" variant="ghost" class="text-destructive" (click)="remove()">
            <ng-icon name="lucideTrash2" aria-hidden="true" />
            {{ t('common.delete') }}
          </button>
        }
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <button hlmBtn type="button" variant="outline" (click)="cancel()">
            {{ t('common.cancel') }}
          </button>
          <button hlmBtn type="submit" [disabled]="saving()">
            @if (saving()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            }
            {{ editing ? t('common.save') : t('goals.form.create') }}
          </button>
        </div>
      </hlm-dialog-footer>
    </form>
  `,
})
export class GoalFormDialog {
  protected readonly t = translate;
  protected readonly ref = inject<BrnDialogRef<GoalDialogResult>>(BrnDialogRef);
  private readonly api = inject(GoalsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly goal = injectBrnDialogContext<GoalFormContext>().goal;

  protected readonly editing = !!this.goal;
  protected readonly fieldClasses = FIELD_CLASSES;
  protected readonly maxMilestones = MAX_MILESTONES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [
      this.goal?.title ?? '',
      [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)],
    ],
    description: [this.goal?.description ?? '', Validators.maxLength(2000)],
    targetDate: [toDateInput(this.goal?.targetDate)],
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
  protected readonly projectIds = signal(new Set(this.goal?.projects.map((p) => p.id) ?? []));

  protected readonly milestones = signal<MilestoneItem[]>(
    this.goal?.milestones.map(({ id, title, done }) => ({ id, title, done })) ?? [],
  );
  protected readonly doneCount = computed(
    () => this.milestones().filter((item) => item.done).length,
  );
  protected readonly newMilestone = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Un jalon a été enregistré pendant la modification. */
  private milestonesChanged = false;

  protected titleInvalid(): boolean {
    const title = this.form.controls.title;
    return title.invalid && (title.touched || title.dirty);
  }

  protected toggleProject(id: string): void {
    this.projectIds.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected addMilestone(): void {
    const title = this.newMilestone().trim();
    if (!title || this.milestones().length >= MAX_MILESTONES) return;
    this.newMilestone.set('');
    if (!this.goal) {
      this.milestones.update((items) => [...items, { id: null, title, done: false }]);
      return;
    }
    this.api.addMilestone(this.goal.id, { title }).subscribe({
      next: (milestone) => {
        this.milestonesChanged = true;
        this.milestones.update((items) => [
          ...items,
          { id: milestone.id, title: milestone.title, done: false },
        ]);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error)),
    });
  }

  protected toggleMilestone(index: number): void {
    const item = this.milestones()[index];
    const done = !item.done;
    this.milestones.update((items) => items.map((it, i) => (i === index ? { ...it, done } : it)));
    if (this.goal && item.id) {
      this.milestonesChanged = true;
      this.api.updateMilestone(this.goal.id, item.id, { done }).subscribe({
        error: (error: unknown) => {
          this.milestones.update((items) => items.map((it, i) => (i === index ? item : it)));
          this.error.set(apiErrorMessage(error));
        },
      });
    }
  }

  protected removeMilestone(index: number): void {
    const item = this.milestones()[index];
    this.milestones.update((items) => items.filter((_, i) => i !== index));
    if (this.goal && item.id) {
      this.milestonesChanged = true;
      this.api.removeMilestone(this.goal.id, item.id).subscribe({
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
    }
  }

  protected cancel(): void {
    this.ref.close(this.milestonesChanged ? { type: 'changed' } : undefined);
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
      targetDate: fromDateInput(value.targetDate),
      projectIds: [...this.projectIds()],
    };

    this.saving.set(true);
    this.error.set(null);
    const request = this.goal
      ? this.api.update(this.goal.id, body)
      : this.api.create({ ...body, milestones: this.milestones().map((item) => item.title) }).pipe(
          // Jalons cochés avant la création : l'API les crée tous « à faire ».
          switchMap((created) => {
            const done = this.milestones()
              .map((item, position) => (item.done ? created.milestones[position]?.id : null))
              .filter((id): id is string => !!id);
            if (!done.length) return of(created);
            return this.markDone(created.id, done);
          }),
        );

    request.subscribe({
      next: (goal) => this.ref.close({ type: 'saved', goal }),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  protected remove(): void {
    const goal = this.goal;
    if (!goal) return;
    this.confirm
      .confirm({
        title: translate('common.deleteTitle', { name: goal.title }),
        description: translate('goals.delete.description'),
        confirmLabel: translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(goal.id)),
      )
      .subscribe({
        next: () => this.ref.close({ type: 'deleted', id: goal.id }),
        error: (error: unknown) => this.error.set(apiErrorMessage(error)),
      });
  }

  /** Coche les jalons indiqués, puis relit l'objectif pour une progression à jour. */
  private markDone(goalId: string, ids: string[]) {
    return ids
      .reduce(
        (chain, id) =>
          chain.pipe(switchMap(() => this.api.updateMilestone(goalId, id, { done: true }))),
        of<unknown>(null),
      )
      .pipe(switchMap(() => this.api.get(goalId)));
  }
}
