import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleX, lucideLoader2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AuthApi } from '../../../core/auth/auth.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { apiErrorMessage } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';

type Status = 'verifying' | 'verified' | 'failed';

/** Atterrissage du lien de vérification : la vérification part dès l'ouverture de la page. */
@Component({
  selector: 'dm-verify-email-page',
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmCardImports],
  providers: [provideIcons({ lucideCircleCheck, lucideCircleX, lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard class="text-center" aria-live="polite">
      @switch (status()) {
        @case ('verifying') {
          <div hlmCardHeader class="items-center">
            <ng-icon
              name="lucideLoader2"
              class="text-muted-foreground mb-2 text-3xl motion-safe:animate-spin"
              aria-hidden="true"
            />
            <h1 hlmCardTitle class="text-xl">{{ t('auth.verify.pending') }}</h1>
          </div>
        }
        @case ('verified') {
          <div hlmCardHeader class="items-center">
            <ng-icon
              name="lucideCircleCheck"
              class="mb-2 text-3xl text-emerald-600"
              aria-hidden="true"
            />
            <h1 hlmCardTitle class="text-xl">{{ t('auth.verify.doneTitle') }}</h1>
            <p hlmCardDescription>{{ t('auth.verify.doneText') }}</p>
          </div>
          <div hlmCardFooter>
            <a
              hlmBtn
              [routerLink]="store.isAuthenticated() ? '/dashboard' : '/login'"
              class="w-full"
            >
              {{ store.isAuthenticated() ? t('auth.verify.toDashboard') : t('auth.login.submit') }}
            </a>
          </div>
        }
        @case ('failed') {
          <div hlmCardHeader class="items-center">
            <ng-icon
              name="lucideCircleX"
              class="text-destructive mb-2 text-3xl"
              aria-hidden="true"
            />
            <h1 hlmCardTitle class="text-xl">{{ t('auth.verify.failedTitle') }}</h1>
            <p hlmCardDescription>{{ error() }} {{ t('auth.verify.failedHint') }}</p>
          </div>
          <div hlmCardFooter>
            @if (store.isAuthenticated()) {
              <a hlmBtn routerLink="/dashboard" class="w-full">{{
                t('auth.verify.resendFromApp')
              }}</a>
            } @else {
              <a hlmBtn routerLink="/login" class="w-full">{{ t('auth.verify.loginForLink') }}</a>
            }
          </div>
        }
      }
    </section>
  `,
})
export class VerifyEmailPage implements OnInit {
  protected readonly t = translate;
  private readonly api = inject(AuthApi);
  protected readonly store = inject(AuthStore);

  /** Jeton du lien reçu par email (?token=…). */
  readonly token = input<string | undefined>();

  protected readonly status = signal<Status>('verifying');
  protected readonly error = signal('');

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.fail(translate('auth.verify.incomplete'));
      return;
    }
    this.api.verifyEmail({ token }).subscribe({
      next: () => {
        this.store.markEmailVerified();
        this.status.set('verified');
      },
      error: (error: unknown) => this.fail(apiErrorMessage(error, translate('auth.verify.failed'))),
    });
  }

  private fail(message: string): void {
    this.error.set(message.endsWith('.') ? message : `${message}.`);
    this.status.set('failed');
  }
}
