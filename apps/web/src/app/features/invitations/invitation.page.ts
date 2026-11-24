import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ReceivedInvitation } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMailX, lucideUsers } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { AuthStore } from '../../core/auth/auth.store';
import { apiErrorMessage } from '../../core/http/api-error';
import { InvitationsApi } from '../../core/invitations/invitations.api';
import { translate } from '../../core/i18n/translate';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; invitation: ReceivedInvitation }
  | { kind: 'invalid' }
  | { kind: 'wrong-account' };

/** Page ouverte depuis le lien de l'email d'invitation (/invitations/:token). */
@Component({
  selector: 'dm-invitation-page',
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmCardImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideMailX, lucideUsers })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg py-6">
      @switch (state().kind) {
        @case ('loading') {
          <div
            class="flex flex-col gap-3"
            aria-busy="true"
            [attr.aria-label]="t('invitations.page.loading')"
          >
            <hlm-skeleton class="h-8 w-2/3" />
            <hlm-skeleton class="h-24 w-full" />
          </div>
        }
        @case ('ready') {
          @if (invitation(); as invitation) {
            <section hlmCard>
              <div hlmCardHeader>
                <ng-icon name="lucideUsers" class="text-primary text-2xl" aria-hidden="true" />
                <h1 hlmCardTitle class="text-xl">
                  {{ t('invitations.page.title', { project: invitation.project.name }) }}
                </h1>
                <p hlmCardDescription>
                  {{ t('invitations.page.intro', { name: invitation.invitedBy.name }) }}
                  {{ t('invitations.asRole', { role: roleLabel(invitation) }) }}.
                </p>
              </div>
              <div hlmCardFooter class="flex gap-2">
                <button hlmBtn [disabled]="busy()" (click)="accept()">
                  {{ t('invitations.accept') }}
                </button>
                <a hlmBtn variant="ghost" routerLink="/dashboard">{{
                  t('invitations.page.back')
                }}</a>
              </div>
            </section>
          }
        }
        @default {
          <section
            class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
          >
            <ng-icon name="lucideMailX" class="text-muted-foreground text-4xl" aria-hidden="true" />
            @if (state().kind === 'wrong-account') {
              <h1 class="text-lg font-medium">{{ t('invitations.page.wrongAccount') }}</h1>
              <p class="text-muted-foreground text-sm">
                {{ t('invitations.page.wrongAccountHint') }} ({{ auth.user()?.email }})
              </p>
            } @else {
              <h1 class="text-lg font-medium">{{ t('invitations.page.invalid') }}</h1>
              <p class="text-muted-foreground text-sm">{{ t('invitations.page.invalidHint') }}</p>
            }
            <a hlmBtn variant="outline" routerLink="/dashboard">{{ t('invitations.page.back') }}</a>
          </section>
        }
      }
    </div>
  `,
})
export class InvitationPage {
  private readonly api = inject(InvitationsApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);

  /** Paramètre de route :token (withComponentInputBinding). */
  readonly token = input.required<string>();

  protected readonly t = translate;
  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      this.state.set({ kind: 'loading' });
      this.api.preview(this.token()).subscribe({
        next: (invitation) => this.state.set({ kind: 'ready', invitation }),
        error: (error: unknown) =>
          this.state.set({
            kind:
              error instanceof HttpErrorResponse && error.status === 403
                ? 'wrong-account'
                : 'invalid',
          }),
      });
    });
  }

  protected invitation(): ReceivedInvitation | null {
    const state = this.state();
    return state.kind === 'ready' ? state.invitation : null;
  }

  protected roleLabel(invitation: ReceivedInvitation): string {
    return translate(`projects.roles.${invitation.role}`).toLowerCase();
  }

  protected accept(): void {
    const invitation = this.invitation();
    if (!invitation) return;
    this.busy.set(true);
    this.api.acceptByToken(this.token()).subscribe({
      next: ({ projectId }) => {
        toast.success(translate('invitations.toast.joined', { project: invitation.project.name }));
        void this.router.navigate(['/projects', projectId]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }
}
