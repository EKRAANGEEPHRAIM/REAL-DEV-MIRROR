import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  AccessRole,
  Project,
  ProjectInvitation,
  ProjectMember,
  ProjectRole,
} from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideMailPlus, lucideUserMinus, lucideX } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { filter, switchMap } from 'rxjs';
import { initialsOf } from '../../../core/auth/auth.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { DEMO_CREDENTIALS } from '../../../core/auth/demo-account';
import { apiErrorMessage } from '../../../core/http/api-error';
import { formatRelative } from '../../../core/i18n/format';
import { translate } from '../../../core/i18n/translate';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { MembersApi } from '../data/members.api';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2';
const ROLES: readonly ProjectRole[] = ['EDITOR', 'VIEWER'];

/**
 * Équipe d'un projet. Tout le monde voit qui en fait partie ; le propriétaire invite,
 * change les rôles et retire des membres ; un membre peut quitter le projet.
 */
@Component({
  selector: 'dm-project-team',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmAvatarImports,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSkeletonImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideLogOut, lucideMailPlus, lucideUserMinus, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard aria-labelledby="team-title">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="team-title">{{ t('projects.team.title') }}</h2>
      </div>
      <div hlmCardContent class="flex flex-col gap-5 text-sm">
        @if (loading()) {
          <div
            class="flex flex-col gap-2"
            aria-busy="true"
            [attr.aria-label]="t('projects.team.loading')"
          >
            <hlm-skeleton class="h-9 w-full" />
            <hlm-skeleton class="h-9 w-full" />
          </div>
        } @else {
          <ul class="flex flex-col gap-3">
            @for (member of members(); track member.userId) {
              <li class="flex items-center gap-3">
                <hlm-avatar class="size-8 text-xs">
                  @if (member.avatarUrl; as url) {
                    <img hlmAvatarImage [src]="url" alt="" />
                  }
                  <span hlmAvatarFallback>{{ initials(member.name) }}</span>
                </hlm-avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">
                    {{ member.name }}
                    @if (member.userId === me()) {
                      <span class="text-muted-foreground font-normal"
                        >({{ t('projects.team.you') }})</span
                      >
                    }
                  </p>
                  <p class="text-muted-foreground truncate text-xs">{{ member.email }}</p>
                </div>

                @if (isOwner() && member.role !== 'OWNER') {
                  <label class="sr-only" [for]="'role-' + member.userId">
                    {{ t('projects.team.changeRole', { name: member.name }) }}
                  </label>
                  <select
                    [id]="'role-' + member.userId"
                    [class]="selectClasses"
                    [value]="member.role"
                    (change)="changeRole(member, $any($event.target).value)"
                  >
                    @for (role of roles; track role) {
                      <option [value]="role">{{ roleLabel(role) }}</option>
                    }
                  </select>
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon"
                    class="text-destructive"
                    [attr.aria-label]="t('projects.team.remove', { name: member.name })"
                    (click)="remove(member)"
                  >
                    <ng-icon name="lucideUserMinus" aria-hidden="true" />
                  </button>
                } @else {
                  <span class="text-muted-foreground shrink-0 text-xs">{{
                    roleLabel(member.role)
                  }}</span>
                }
              </li>
            }
          </ul>

          @if (isOwner()) {
            @if (invitations().length) {
              <div class="flex flex-col gap-2">
                <h3 class="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {{ t('projects.team.pending') }}
                </h3>
                <ul class="flex flex-col gap-2">
                  @for (invitation of invitations(); track invitation.id) {
                    <li class="flex items-center gap-2">
                      <span class="min-w-0 flex-1 truncate">{{ invitation.email }}</span>
                      <span class="text-muted-foreground shrink-0 text-xs">
                        {{ roleLabel(invitation.role) }} ·
                        {{ t('projects.team.expires', { date: relative(invitation.expiresAt) }) }}
                      </span>
                      <button
                        hlmBtn
                        variant="ghost"
                        size="icon"
                        [attr.aria-label]="t('projects.team.revoke')"
                        (click)="revoke(invitation)"
                      >
                        <ng-icon name="lucideX" aria-hidden="true" />
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (isDemo()) {
              <p class="text-muted-foreground text-xs">{{ t('projects.team.demoHint') }}</p>
            } @else {
              <form class="flex flex-col gap-2" [formGroup]="form" (ngSubmit)="invite()">
                <h3 class="font-medium">{{ t('projects.team.inviteTitle') }}</h3>
                <label hlmLabel for="invite-email" class="sr-only">{{
                  t('projects.team.emailLabel')
                }}</label>
                <input
                  hlmInput
                  id="invite-email"
                  type="email"
                  autocomplete="off"
                  formControlName="email"
                  [placeholder]="t('projects.team.emailPlaceholder')"
                />
                <div class="flex gap-2">
                  <label class="sr-only" for="invite-role">{{
                    t('projects.team.roleLabel')
                  }}</label>
                  <select
                    id="invite-role"
                    formControlName="role"
                    [class]="selectClasses + ' flex-1'"
                  >
                    @for (role of roles; track role) {
                      <option [value]="role">{{ roleLabel(role) }} — {{ roleHint(role) }}</option>
                    }
                  </select>
                  <button hlmBtn type="submit" [disabled]="form.invalid || sending()">
                    <ng-icon name="lucideMailPlus" aria-hidden="true" />
                    {{ sending() ? t('projects.team.sending') : t('projects.team.invite') }}
                  </button>
                </div>
                @if (inviteError()) {
                  <dm-form-alert>{{ inviteError() }}</dm-form-alert>
                }
              </form>
            }
          } @else {
            <button hlmBtn variant="outline" class="self-start" (click)="leave()">
              <ng-icon name="lucideLogOut" aria-hidden="true" />
              {{ t('projects.team.leave') }}
            </button>
          }
        }
      </div>
    </section>
  `,
})
export class ProjectTeam {
  private readonly api = inject(MembersApi);
  private readonly auth = inject(AuthStore);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly project = input.required<Project>();
  /** La liste des membres a changé (le compteur du projet est à rafraîchir). */
  readonly changed = output<void>();

  protected readonly t = translate;
  protected readonly roles = ROLES;
  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly members = signal<ProjectMember[]>([]);
  protected readonly invitations = signal<ProjectInvitation[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly inviteError = signal<string | null>(null);

  protected readonly me = computed(() => this.auth.user()?.id);
  protected readonly isOwner = computed(() => this.project().role === 'OWNER');
  protected readonly isDemo = computed(() => this.auth.user()?.email === DEMO_CREDENTIALS.email);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: this.fb.control<ProjectRole>('EDITOR'),
  });

  constructor() {
    // Recharge l'équipe à chaque projet affiché (navigation d'un projet à l'autre).
    effect(() => this.load(this.project().id, this.project().role === 'OWNER'));
  }

  protected initials = initialsOf;
  protected relative = formatRelative;

  protected roleLabel(role: AccessRole): string {
    return translate(`projects.roles.${role}`);
  }

  protected roleHint(role: ProjectRole): string {
    return translate(`projects.roleHints.${role}`);
  }

  private load(projectId: string, isOwner: boolean): void {
    this.loading.set(true);
    this.api.members(projectId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
    if (isOwner) {
      this.api.invitations(projectId).subscribe({
        next: (invitations) => this.invitations.set(invitations),
        error: () => this.invitations.set([]),
      });
    } else {
      this.invitations.set([]);
    }
  }

  protected invite(): void {
    if (this.form.invalid) return;
    const { email, role } = this.form.getRawValue();
    this.sending.set(true);
    this.inviteError.set(null);
    this.api.invite(this.project().id, { email, role }).subscribe({
      next: (invitation) => {
        this.sending.set(false);
        this.form.reset({ email: '', role });
        this.invitations.update((list) => [
          invitation,
          ...list.filter((item) => item.email !== invitation.email),
        ]);
        toast.success(translate('projects.team.toast.invited', { email: invitation.email }));
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.inviteError.set(apiErrorMessage(error));
      },
    });
  }

  protected revoke(invitation: ProjectInvitation): void {
    this.api.revoke(this.project().id, invitation.id).subscribe({
      next: () => {
        this.invitations.update((list) => list.filter((item) => item.id !== invitation.id));
        toast.success(translate('projects.team.toast.revoked'));
      },
      error: (error: unknown) => toast.error(apiErrorMessage(error)),
    });
  }

  protected changeRole(member: ProjectMember, role: ProjectRole): void {
    this.api.updateMember(this.project().id, member.userId, { role }).subscribe({
      next: (updated) => {
        this.members.update((list) =>
          list.map((item) => (item.userId === updated.userId ? updated : item)),
        );
        toast.success(
          translate('projects.team.toast.roleChanged', {
            name: updated.name,
            role: this.roleLabel(updated.role).toLowerCase(),
          }),
        );
      },
      error: (error: unknown) => toast.error(apiErrorMessage(error)),
    });
  }

  protected remove(member: ProjectMember): void {
    this.confirm
      .confirm({
        title: translate('projects.team.removeConfirm.title', { name: member.name }),
        description: translate('projects.team.removeConfirm.description'),
        confirmLabel: translate('projects.team.remove', { name: member.name }),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.removeMember(this.project().id, member.userId)),
      )
      .subscribe({
        next: () => {
          this.members.update((list) => list.filter((item) => item.userId !== member.userId));
          this.changed.emit();
          toast.success(translate('projects.team.toast.removed', { name: member.name }));
        },
        error: (error: unknown) => toast.error(apiErrorMessage(error)),
      });
  }

  protected leave(): void {
    const me = this.me();
    if (!me) return;
    this.confirm
      .confirm({
        title: translate('projects.team.leaveConfirm.title', { name: this.project().name }),
        description: translate('projects.team.leaveConfirm.description'),
        confirmLabel: translate('projects.team.leave'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.removeMember(this.project().id, me)),
      )
      .subscribe({
        next: () => {
          toast.success(translate('projects.team.toast.left'));
          void this.router.navigate(['/projects']);
        },
        error: (error: unknown) => toast.error(apiErrorMessage(error)),
      });
  }
}
