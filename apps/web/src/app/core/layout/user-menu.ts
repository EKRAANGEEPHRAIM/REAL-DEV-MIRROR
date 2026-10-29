import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideSettings } from '@ng-icons/lucide';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { AuthStore } from '../auth/auth.store';

/** Avatar de l'utilisateur connecté et son menu (paramètres, déconnexion). */
@Component({
  selector: 'dm-user-menu',
  imports: [RouterLink, NgIcon, HlmAvatarImports, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideLogOut, lucideSettings })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      hlmBtn
      variant="ghost"
      size="icon"
      class="rounded-full"
      [hlmDropdownMenuTrigger]="menu"
      align="end"
      [attr.aria-label]="'Menu du compte de ' + (store.user()?.name ?? '')"
    >
      <hlm-avatar size="sm">
        @if (store.user()?.avatarUrl; as url) {
          <img hlmAvatarImage [src]="url" alt="" />
        }
        <span hlmAvatarFallback>{{ store.initials() }}</span>
      </hlm-avatar>
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-60">
        <div hlmDropdownMenuLabel class="flex flex-col">
          <span class="truncate">{{ store.user()?.name }}</span>
          <span class="text-muted-foreground truncate text-xs font-normal">{{
            store.user()?.email
          }}</span>
        </div>
        <hlm-dropdown-menu-separator />
        <a hlmDropdownMenuItem routerLink="/settings">
          <ng-icon name="lucideSettings" aria-hidden="true" />
          Paramètres
        </a>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem variant="destructive" (triggered)="store.logout()">
          <ng-icon name="lucideLogOut" aria-hidden="true" />
          Se déconnecter
        </button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class UserMenu {
  protected readonly store = inject(AuthStore);
}
