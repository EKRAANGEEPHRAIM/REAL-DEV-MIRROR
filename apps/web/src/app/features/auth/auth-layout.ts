import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LanguageSwitcher } from '../../core/i18n/language-switcher';
import { translate } from '../../core/i18n/translate';
import { Logo } from '../../core/layout/logo';
import { ThemeToggle } from '../../core/theme/theme-toggle';

/** Mise en page des pages publiques d'authentification : carte centrée, logo, thème. */
@Component({
  selector: 'dm-auth-layout',
  imports: [RouterOutlet, RouterLink, ThemeToggle, LanguageSwitcher, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background text-foreground flex min-h-dvh flex-col">
      <header class="flex h-14 items-center justify-between px-4 md:px-6">
        <a routerLink="/" class="flex items-center"><dm-logo /></a>
        <div class="flex items-center gap-2">
          <dm-language-switcher />
          <!-- Menu du thème (CDK) chargé après l'affichage : hors du bundle initial. -->
          @defer (on idle) {
            <dm-theme-toggle />
          } @placeholder {
            <span class="inline-block size-9" aria-hidden="true"></span>
          }
        </div>
      </header>
      <main class="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0">
        <div class="w-full max-w-sm">
          <router-outlet />
        </div>
      </main>
      <footer class="text-muted-foreground pb-6 text-center text-xs">
        <a routerLink="/legal" class="hover:underline">{{ t('layout.legal') }}</a>
      </footer>
    </div>
  `,
})
export class AuthLayout {
  protected readonly t = translate;
}
