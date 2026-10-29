import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideMailCheck } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthApi } from '../../../core/auth/auth.api';
import { apiErrorMessage } from '../../../core/http/api-error';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { translate } from '../../../core/i18n/translate';

@Component({
  selector: 'dm-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideLoader2, lucideMailCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard>
      @if (sentTo(); as email) {
        <div hlmCardHeader>
          <ng-icon name="lucideMailCheck" class="text-primary mb-2 text-3xl" aria-hidden="true" />
          <h1 hlmCardTitle class="text-xl">{{ t('auth.forgot.sentTitle') }}</h1>
          <p hlmCardDescription>
            {{ t('auth.forgot.sentBefore') }} <strong class="text-foreground">{{ email }}</strong
            >{{ t('auth.forgot.sentAfter') }}
          </p>
        </div>
        <div hlmCardFooter class="justify-center">
          <a hlmBtn variant="outline" routerLink="/login" class="w-full">{{
            t('auth.backToLogin')
          }}</a>
        </div>
      } @else {
        <div hlmCardHeader>
          <h1 hlmCardTitle class="text-xl">{{ t('auth.forgot.title') }}</h1>
          <p hlmCardDescription>
            {{ t('auth.forgot.subtitle') }}
          </p>
        </div>

        <form
          hlmCardContent
          class="flex flex-col gap-4"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          @if (error(); as message) {
            <dm-form-alert>{{ message }}</dm-form-alert>
          }

          <div class="flex flex-col gap-2">
            <label hlmLabel for="email">{{ t('auth.email') }}</label>
            <input
              hlmInput
              id="email"
              type="email"
              autocomplete="email"
              formControlName="email"
              [attr.aria-invalid]="showError()"
              aria-describedby="email-error"
            />
            @if (showError()) {
              <p id="email-error" class="text-destructive text-sm">
                {{ t('auth.errors.email') }}
              </p>
            }
          </div>

          <button hlmBtn type="submit" class="w-full" [disabled]="sending()">
            @if (sending()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
              {{ t('common.sending') }}
            } @else {
              {{ t('auth.forgot.submit') }}
            }
          </button>
        </form>

        <p hlmCardFooter class="text-muted-foreground justify-center text-sm">
          <a routerLink="/login" class="text-foreground font-medium hover:underline">{{
            t('auth.backToLogin')
          }}</a>
        </p>
      }
    </section>
  `,
})
export class ForgotPasswordPage {
  protected readonly t = translate;
  private readonly api = inject(AuthApi);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Adresse saisie une fois la demande acceptée ; l'API répond pareil qu'elle existe ou non. */
  protected readonly sentTo = signal<string | null>(null);

  protected showError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email } = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.api.forgotPassword({ email }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sentTo.set(email.trim().toLowerCase());
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
