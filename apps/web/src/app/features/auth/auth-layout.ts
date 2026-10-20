import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideScanFace } from '@ng-icons/lucide';
import { ThemeToggle } from '../../core/theme/theme-toggle';

/** Mise en page des pages publiques d'authentification : carte centrée, logo, thème. */
@Component({
  selector: 'dm-auth-layout',
  imports: [RouterOutlet, RouterLink, NgIcon, ThemeToggle],
  providers: [provideIcons({ lucideScanFace })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-muted/40 text-foreground flex min-h-dvh flex-col">
      <header class="flex h-14 items-center justify-between px-4 md:px-6">
        <a routerLink="/login" class="flex items-center gap-2 font-semibold">
          <ng-icon name="lucideScanFace" class="text-primary text-xl" aria-hidden="true" />
          DevMirror
        </a>
        <dm-theme-toggle />
      </header>
      <main class="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0">
        <div class="w-full max-w-sm">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AuthLayout {}
