import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImageUp, lucideLoader2, lucideTrash2, lucideUserRound } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AccountApi } from '../../../core/account/account.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { apiErrorMessage } from '../../../core/http/api-error';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { type TranslationKey, translate } from '../../../core/i18n/translate';

/** Mêmes limites que l'API : vérifiées avant l'envoi pour un message immédiat. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function avatarFileError(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return translate('settings.profile.avatarType');
  if (file.size > AVATAR_MAX_BYTES) return translate('settings.profile.avatarSize');
  return null;
}

const URL_PATTERN = /^https?:\/\/\S+$/i;
const FIELD_CLASSES =
  'border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2';

@Component({
  selector: 'dm-profile-settings',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmAvatarImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideImageUp, lucideLoader2, lucideTrash2, lucideUserRound })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="profile-heading" class="rounded-xl border p-5">
      <h2 id="profile-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideUserRound" aria-hidden="true" />
        {{ t('settings.profile.title') }}
      </h2>

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <hlm-avatar class="size-16 text-lg">
          @if (auth.user()?.avatarUrl; as url) {
            <img hlmAvatarImage [src]="url" [alt]="t('settings.profile.avatarAlt')" />
          }
          <span hlmAvatarFallback>{{ auth.initials() }}</span>
        </hlm-avatar>
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <input
              #fileInput
              type="file"
              class="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif"
              tabindex="-1"
              aria-hidden="true"
              (change)="onFile($any($event.target))"
            />
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="sm"
              [disabled]="avatarBusy()"
              (click)="fileInput.click()"
            >
              @if (avatarBusy()) {
                <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
              } @else {
                <ng-icon name="lucideImageUp" aria-hidden="true" />
              }
              {{ t('settings.profile.changeAvatar') }}
            </button>
            @if (auth.user()?.avatarUrl) {
              <button
                hlmBtn
                type="button"
                variant="ghost"
                size="sm"
                [disabled]="avatarBusy()"
                (click)="removeAvatar()"
              >
                <ng-icon name="lucideTrash2" aria-hidden="true" />
                {{ t('settings.profile.removeAvatar') }}
              </button>
            }
          </div>
          <p class="text-muted-foreground text-xs">{{ t('settings.profile.avatarHint') }}</p>
        </div>
      </div>
      @if (avatarError(); as message) {
        <dm-form-alert class="mt-3 block">{{ message }}</dm-form-alert>
      }

      <form class="mt-6 flex flex-col gap-4" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (error(); as message) {
          <dm-form-alert>{{ message }}</dm-form-alert>
        }
        <div class="flex flex-col gap-2">
          <label hlmLabel for="profile-name">{{ t('auth.name') }} *</label>
          <input
            hlmInput
            id="profile-name"
            formControlName="name"
            maxlength="80"
            autocomplete="name"
            [attr.aria-invalid]="invalid('name')"
          />
          @if (invalid('name')) {
            <p class="text-destructive text-sm">{{ t('settings.profile.nameError') }}</p>
          }
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="profile-bio">{{ t('settings.profile.bio') }}</label>
          <textarea
            id="profile-bio"
            rows="3"
            maxlength="500"
            formControlName="bio"
            [placeholder]="t('settings.profile.bioPlaceholder')"
            [class]="fieldClasses"
          ></textarea>
        </div>
        <div class="grid gap-4 lg:grid-cols-3">
          @for (link of links; track link.key) {
            <div class="flex flex-col gap-2">
              <label hlmLabel [for]="'profile-' + link.key">{{ t(link.label) }}</label>
              <input
                hlmInput
                type="url"
                [id]="'profile-' + link.key"
                [formControlName]="link.key"
                [placeholder]="link.placeholder"
                [attr.aria-invalid]="invalid(link.key)"
              />
              @if (invalid(link.key)) {
                <p class="text-destructive text-xs">{{ t('common.urlInvalid') }}</p>
              }
            </div>
          }
        </div>
        <div>
          <button hlmBtn type="submit" [disabled]="saving()">
            @if (saving()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            }
            {{ t('settings.profile.save') }}
          </button>
        </div>
      </form>
    </section>
  `,
})
export class ProfileSettings {
  protected readonly t = translate;
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(AccountApi);

  protected readonly fieldClasses = FIELD_CLASSES;
  protected readonly links: readonly {
    key: 'github' | 'linkedin' | 'website';
    label: TranslationKey;
    placeholder: string;
  }[] = [
    { key: 'github', label: 'settings.profile.github', placeholder: 'https://github.com/…' },
    {
      key: 'linkedin',
      label: 'settings.profile.linkedin',
      placeholder: 'https://linkedin.com/in/…',
    },
    { key: 'website', label: 'settings.profile.website', placeholder: 'https://…' },
  ];

  private readonly user = this.auth.user();
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.user?.name ?? '',
      [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)],
    ],
    bio: [this.user?.bio ?? '', Validators.maxLength(500)],
    github: [this.user?.links.github ?? '', Validators.pattern(URL_PATTERN)],
    linkedin: [this.user?.links.linkedin ?? '', Validators.pattern(URL_PATTERN)],
    website: [this.user?.links.website ?? '', Validators.pattern(URL_PATTERN)],
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly avatarBusy = signal(false);
  protected readonly avatarError = signal<string | null>(null);

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .updateProfile({
        name: value.name.trim(),
        bio: value.bio.trim() || null,
        links: {
          github: value.github.trim() || null,
          linkedin: value.linkedin.trim() || null,
          website: value.website.trim() || null,
        },
      })
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.auth.setUser(user);
          this.form.markAsPristine();
          toast.success(translate('settings.profile.saved'));
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(error));
        },
      });
  }

  protected onFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = ''; // permet de renvoyer le même fichier après une erreur
    if (!file) return;
    const problem = avatarFileError(file);
    this.avatarError.set(problem);
    if (problem) return;

    this.avatarBusy.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: (user) => {
        this.avatarBusy.set(false);
        this.auth.setUser(user);
        toast.success(translate('settings.profile.avatarUpdated'));
      },
      error: (error: unknown) => {
        this.avatarBusy.set(false);
        this.avatarError.set(apiErrorMessage(error));
      },
    });
  }

  protected removeAvatar(): void {
    const user = this.auth.user();
    if (!user) return;
    this.avatarBusy.set(true);
    this.avatarError.set(null);
    this.api.removeAvatar().subscribe({
      next: () => {
        this.avatarBusy.set(false);
        this.auth.setUser({ ...user, avatarUrl: null });
        toast.success(translate('settings.profile.avatarRemoved'));
      },
      error: (error: unknown) => {
        this.avatarBusy.set(false);
        this.avatarError.set(apiErrorMessage(error));
      },
    });
  }
}
