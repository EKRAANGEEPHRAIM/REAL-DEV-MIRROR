import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthApi } from '../../../core/auth/auth.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { apiErrorMessage } from '../../../core/http/api-error';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { PasswordChecklist } from '../password-checklist';
import { passwordsMatchValidator, passwordValidator } from '../password-rules';
import { translate } from '../../../core/i18n/translate';

@Component({
  selector: 'dm-reset-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
    PasswordChecklist,
  ],
  providers: [provideIcons({ lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle class="text-xl">{{ t('auth.reset.title') }}</h1>
        <p hlmCardDescription>{{ t('auth.reset.subtitle') }}</p>
      </div>

      @if (!token()) {
        <div hlmCardContent class="flex flex-col gap-4">
          <dm-form-alert>{{ t('auth.reset.incomplete') }}</dm-form-alert>
          <a hlmBtn routerLink="/forgot-password" class="w-full">{{ t('auth.reset.newLink') }}</a>
        </div>
      } @else {
        <form
          hlmCardContent
          class="flex flex-col gap-4"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          @if (error(); as message) {
            <dm-form-alert>
              {{ message }}
              <a routerLink="/forgot-password" class="ms-1 font-medium underline">{{
                t('auth.reset.newLink')
              }}</a>
            </dm-form-alert>
          }

          <div class="flex flex-col gap-2">
            <label hlmLabel for="password">{{ t('auth.reset.password') }}</label>
            <input
              hlmInput
              id="password"
              type="password"
              autocomplete="new-password"
              formControlName="password"
              aria-describedby="password-rules"
            />
            <dm-password-checklist [password]="password()" />
          </div>

          <div class="flex flex-col gap-2">
            <label hlmLabel for="confirm">{{ t('auth.reset.confirm') }}</label>
            <input
              hlmInput
              id="confirm"
              type="password"
              autocomplete="new-password"
              formControlName="confirm"
              [attr.aria-invalid]="showMismatch()"
              aria-describedby="confirm-error"
            />
            @if (showMismatch()) {
              <p id="confirm-error" class="text-destructive text-sm">
                {{ t('auth.errors.mismatch') }}
              </p>
            }
          </div>

          <button hlmBtn type="submit" class="mt-2 w-full" [disabled]="saving()">
            @if (saving()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
              {{ t('auth.reset.pending') }}
            } @else {
              {{ t('auth.reset.submit') }}
            }
          </button>
        </form>
      }
    </section>
  `,
})
export class ResetPasswordPage {
  protected readonly t = translate;
  private readonly api = inject(AuthApi);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  /** Jeton du lien reçu par email (?token=…). */
  readonly token = input<string | undefined>();

  protected readonly form = inject(NonNullableFormBuilder).group(
    { password: ['', passwordValidator], confirm: [''] },
    { validators: passwordsMatchValidator },
  );
  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected showMismatch(): boolean {
    const confirm = this.form.controls.confirm;
    return this.form.hasError('mismatch') && (confirm.touched || confirm.dirty);
  }

  protected submit(): void {
    const token = this.token();
    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.resetPassword({ token, password: this.form.getRawValue().password }).subscribe({
      next: () => {
        // L'API a fermé toutes les sessions : la session locale aussi.
        this.store.clearSession();
        toast.success(translate('auth.reset.done'));
        void this.router.navigateByUrl('/login');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
