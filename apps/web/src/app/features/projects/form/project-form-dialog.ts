import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Project, ProjectStatus, Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideLoader2 } from '@ng-icons/lucide';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { catchError, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { TagsApi } from '../../../shared/data/tags.api';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { ProjectsApi } from '../data/projects.api';
import { PROJECT_STATUSES } from '../project-status';
import { PROJECT_COLORS, parseTechStack, toFormValue, toRequest } from './project-form.model';
import { translate } from '../../../core/i18n/translate';

export interface ProjectFormContext {
  /** Projet à modifier ; absent pour une création. */
  project?: Project;
}

const URL_PATTERN = /^https?:\/\/\S+$/;
const FIELD_CLASSES =
  'border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2';

/** Création et modification d'un projet ; se ferme avec le projet enregistré. */
@Component({
  selector: 'dm-project-form-dialog',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideCheck, lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog-header>
      <h2 hlmDialogTitle>
        {{ editing ? t('projects.form.editTitle') : t('projects.form.newTitle') }}
      </h2>
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
        <label hlmLabel for="project-name">{{ t('projects.form.name') }} *</label>
        <input
          hlmInput
          id="project-name"
          formControlName="name"
          maxlength="120"
          [attr.aria-invalid]="invalid('name')"
          aria-describedby="project-name-error"
        />
        @if (invalid('name')) {
          <p id="project-name-error" class="text-destructive text-sm">
            {{ t('projects.form.nameError') }}
          </p>
        }
      </div>

      <div class="flex flex-col gap-2">
        <label hlmLabel for="project-description">{{ t('projects.form.description') }}</label>
        <textarea
          id="project-description"
          rows="3"
          maxlength="2000"
          formControlName="description"
          [class]="fieldClasses"
        ></textarea>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label hlmLabel for="project-status">{{ t('projects.form.status') }}</label>
          <select id="project-status" formControlName="status" [class]="fieldClasses">
            @for (status of statuses; track status.value) {
              <option [value]="status.value">{{ t(status.label) }}</option>
            }
          </select>
        </div>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-medium">{{ t('projects.form.color') }}</legend>
          <div class="flex flex-wrap gap-2">
            @for (color of colors; track color) {
              <button
                type="button"
                class="ring-offset-background flex size-7 items-center justify-center rounded-full text-white ring-offset-2 focus-visible:ring-2"
                [class.ring-2]="form.controls.color.value === color"
                [class.ring-foreground]="form.controls.color.value === color"
                [style.background-color]="color"
                [attr.aria-label]="t('projects.form.colorOption', { color })"
                [attr.aria-pressed]="form.controls.color.value === color"
                (click)="form.controls.color.setValue(color)"
              >
                @if (form.controls.color.value === color) {
                  <ng-icon name="lucideCheck" class="text-sm" aria-hidden="true" />
                }
              </button>
            }
          </div>
        </fieldset>
      </div>

      <div class="flex flex-col gap-2">
        <label hlmLabel for="project-stack">{{ t('projects.form.techStack') }}</label>
        <input
          hlmInput
          id="project-stack"
          formControlName="techStack"
          placeholder="Angular, NestJS, Prisma"
          aria-describedby="project-stack-hint"
        />
        <p id="project-stack-hint" class="text-muted-foreground text-xs">
          {{ t('projects.form.techStackHint') }}
        </p>
        @if (techPreview().length) {
          <div class="flex flex-wrap gap-1.5" aria-hidden="true">
            @for (tech of techPreview(); track tech) {
              <span hlmBadge variant="secondary">{{ tech }}</span>
            }
          </div>
        }
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label hlmLabel for="project-repo">{{ t('projects.form.repoUrl') }}</label>
          <input
            hlmInput
            id="project-repo"
            type="url"
            formControlName="repoUrl"
            placeholder="https://github.com/…"
            [attr.aria-invalid]="invalid('repoUrl')"
          />
          @if (invalid('repoUrl')) {
            <p class="text-destructive text-sm">{{ t('common.urlInvalid') }}</p>
          }
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="project-demo">{{ t('projects.form.demoUrl') }}</label>
          <input
            hlmInput
            id="project-demo"
            type="url"
            formControlName="demoUrl"
            placeholder="https://…"
            [attr.aria-invalid]="invalid('demoUrl')"
          />
          @if (invalid('demoUrl')) {
            <p class="text-destructive text-sm">{{ t('common.urlInvalid') }}</p>
          }
        </div>
      </div>

      @if (tags().length) {
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-medium">{{ t('projects.form.tags') }}</legend>
          <div class="flex flex-wrap gap-x-4 gap-y-2">
            @for (tag of tags(); track tag.id) {
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  class="accent-primary size-4"
                  [checked]="hasTag(tag.id)"
                  (change)="toggleTag(tag.id)"
                />
                #{{ tag.name }}
              </label>
            }
          </div>
        </fieldset>
      }

      <hlm-dialog-footer class="bg-background sticky bottom-0 pt-2">
        <button hlmBtn type="button" variant="outline" (click)="ref.close()">
          {{ t('common.cancel') }}
        </button>
        <button hlmBtn type="submit" [disabled]="saving()">
          @if (saving()) {
            <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
          }
          {{ editing ? t('common.save') : t('projects.form.create') }}
        </button>
      </hlm-dialog-footer>
    </form>
  `,
})
export class ProjectFormDialog {
  protected readonly t = translate;
  protected readonly ref = inject<BrnDialogRef<Project>>(BrnDialogRef);
  private readonly api = inject(ProjectsApi);
  private readonly context = injectBrnDialogContext<ProjectFormContext>();

  protected readonly editing = !!this.context.project;
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly colors = PROJECT_COLORS;
  protected readonly fieldClasses = FIELD_CLASSES;

  private readonly initial = toFormValue(this.context.project);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.initial.name,
      [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)],
    ],
    description: [this.initial.description, Validators.maxLength(2000)],
    status: [this.initial.status as ProjectStatus],
    techStack: [this.initial.techStack],
    repoUrl: [this.initial.repoUrl, Validators.pattern(URL_PATTERN)],
    demoUrl: [this.initial.demoUrl, Validators.pattern(URL_PATTERN)],
    color: [this.initial.color as string | null],
    tagIds: [this.initial.tagIds],
  });

  private readonly techInput = toSignal(this.form.controls.techStack.valueChanges, {
    initialValue: this.initial.techStack,
  });
  protected readonly techPreview = computed(() => parseTechStack(this.techInput()));
  private readonly selectedTags = toSignal(this.form.controls.tagIds.valueChanges, {
    initialValue: this.initial.tagIds,
  });
  protected readonly tags = toSignal(
    inject(TagsApi)
      .list()
      .pipe(catchError(() => of([] as Tag[]))),
    {
      initialValue: [] as Tag[],
    },
  );

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(control: 'name' | 'repoUrl' | 'demoUrl'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  protected hasTag(id: string): boolean {
    return this.selectedTags().includes(id);
  }

  protected toggleTag(id: string): void {
    const current = this.form.controls.tagIds.value;
    this.form.controls.tagIds.setValue(
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = toRequest(this.form.getRawValue());
    const project = this.context.project;
    const request = project ? this.api.update(project.id, body) : this.api.create(body);

    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
