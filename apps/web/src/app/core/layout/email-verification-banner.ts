import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMailWarning } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AuthApi } from '../auth/auth.api';
import { AuthStore } from '../auth/auth.store';
import { apiErrorMessage } from '../http/api-error';

/** Bandeau affiché tant que l'adresse email du compte n'est pas confirmée. */
@Component({
  selector: 'dm-email-verification-banner',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideMailWarning })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        role="status"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm md:px-6"
      >
        <ng-icon name="lucideMailWarning" class="shrink-0 text-amber-600" aria-hidden="true" />
        <span class="flex-1">
          Confirmez votre adresse <strong>{{ store.user()?.email }}</strong> avec le lien reçu par
          email.
        </span>
        <button hlmBtn variant="outline" size="sm" [disabled]="sending()" (click)="resend()">
          {{ sending() ? 'Envoi…' : 'Renvoyer l’email' }}
        </button>
      </div>
    }
  `,
})
export class EmailVerificationBanner {
  private readonly api = inject(AuthApi);
  protected readonly store = inject(AuthStore);
  protected readonly sending = signal(false);
  protected readonly visible = computed(() => {
    const user = this.store.user();
    return !!user && !user.emailVerified;
  });

  protected resend(): void {
    this.sending.set(true);
    this.api.resendVerification().subscribe({
      next: () => {
        this.sending.set(false);
        toast.success('Email envoyé. Le lien est valable 1 heure.');
      },
      error: (error: unknown) => {
        this.sending.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }
}
