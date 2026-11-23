import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { ReceivedInvitation } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUsers } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AuthStore } from '../auth/auth.store';
import { apiErrorMessage } from '../http/api-error';
import { translate } from '../i18n/translate';
import { InvitationsApi } from './invitations.api';

/** Invitations en attente, affichées en haut de l'application jusqu'à réponse. */
@Component({
  selector: 'dm-invitations-banner',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideUsers })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (invitations().length) {
      <section
        role="status"
        class="border-primary/20 bg-primary/5 flex flex-col gap-2 border-b px-4 py-2 text-sm md:px-6"
        [attr.aria-label]="t('invitations.banner', { count: invitations().length })"
      >
        @for (invitation of invitations(); track invitation.id) {
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ng-icon name="lucideUsers" class="text-primary shrink-0" aria-hidden="true" />
            <span class="flex-1">
              {{
                t('invitations.invitedBy', {
                  name: invitation.invitedBy.name,
                  project: invitation.project.name,
                })
              }}
              <span class="text-muted-foreground">
                {{ t('invitations.asRole', { role: roleLabel(invitation) }) }}
              </span>
            </span>
            <button
              hlmBtn
              size="sm"
              [disabled]="busy() === invitation.id"
              (click)="accept(invitation)"
            >
              {{ t('invitations.accept') }}
            </button>
            <button
              hlmBtn
              size="sm"
              variant="ghost"
              [disabled]="busy() === invitation.id"
              (click)="decline(invitation)"
            >
              {{ t('invitations.decline') }}
            </button>
          </div>
        }
      </section>
    }
  `,
})
export class InvitationsBanner {
  private readonly api = inject(InvitationsApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly t = translate;
  protected readonly invitations = signal<ReceivedInvitation[]>([]);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    // Rechargé à chaque changement de compte (connexion, déconnexion)
    effect(() => {
      if (!this.auth.user()?.id) {
        this.invitations.set([]);
        return;
      }
      this.api.received().subscribe({
        next: (invitations) => this.invitations.set(invitations),
        error: () => this.invitations.set([]),
      });
    });
  }

  protected roleLabel(invitation: ReceivedInvitation): string {
    return translate(`projects.roles.${invitation.role}`).toLowerCase();
  }

  protected accept(invitation: ReceivedInvitation): void {
    this.busy.set(invitation.id);
    this.api.accept(invitation.id).subscribe({
      next: ({ projectId }) => {
        this.remove(invitation);
        toast.success(translate('invitations.toast.joined', { project: invitation.project.name }));
        void this.router.navigate(['/projects', projectId]);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  protected decline(invitation: ReceivedInvitation): void {
    this.busy.set(invitation.id);
    this.api.decline(invitation.id).subscribe({
      next: () => {
        this.remove(invitation);
        toast.success(translate('invitations.toast.declined'));
      },
      error: (error: unknown) => {
        this.busy.set(null);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  private remove(invitation: ReceivedInvitation): void {
    this.busy.set(null);
    this.invitations.update((list) => list.filter((item) => item.id !== invitation.id));
  }
}
