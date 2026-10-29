import { ChangeDetectionStrategy, Component, inject, input, type OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthStore } from '../../../core/auth/auth.store';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { translate } from '../../../core/i18n/translate';

@Component({
  selector: 'dm-login-page',
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
  providers: [provideIcons({ lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle class="text-xl">{{ t('auth.login.title') }}</h1>
        <p hlmCardDescription>{{ t('auth.login.subtitle') }}</p>
      </div>

      <form
        hlmCardContent
        class="flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        @if (store.error(); as error) {
          <dm-form-alert>{{ error }}</dm-form-alert>
        }

        <div class="flex flex-col gap-2">
          <label hlmLabel for="email">{{ t('auth.email') }}</label>
          <input
            hlmInput
            id="email"
            type="email"
            autocomplete="email"
            formControlName="email"
            [attr.aria-invalid]="showError('email')"
            aria-describedby="email-error"
          />
          @if (showError('email')) {
            <p id="email-error" class="text-destructive text-sm">
              {{ t('auth.errors.email') }}
            </p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label hlmLabel for="password">{{ t('auth.password') }}</label>
            <a routerLink="/forgot-password" class="text-muted-foreground text-sm hover:underline">
              {{ t('auth.login.forgot') }}
            </a>
          </div>
          <input
            hlmInput
            id="password"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            [attr.aria-invalid]="showError('password')"
            aria-describedby="password-error"
          />
          @if (showError('password')) {
            <p id="password-error" class="text-destructive text-sm">
              {{ t('auth.errors.passwordRequired') }}
            </p>
          }
        </div>

        <button hlmBtn type="submit" class="mt-2 w-full" [disabled]="store.pending()">
          @if (store.pending()) {
            <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            {{ t('auth.login.pending') }}
          } @else {
            {{ t('auth.login.submit') }}
          }
        </button>
      </form>

      <p hlmCardFooter class="text-muted-foreground justify-center text-sm">
        {{ t('auth.login.noAccount') }}
        <a routerLink="/register" class="text-foreground ms-1 font-medium hover:underline">{{
          t('auth.login.createAccount')
        }}</a>
      </p>
    </section>
  `,
})
export class LoginPage implements OnInit {
  protected readonly t = translate;
  protected readonly store = inject(AuthStore);
  /** Page demandée avant la redirection vers la connexion (paramètre ?returnUrl=). */
  readonly returnUrl = input<string | undefined>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    this.store.clearError();
  }

  protected showError(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.login({ credentials: this.form.getRawValue(), returnUrl: this.returnUrl() });
  }
}
