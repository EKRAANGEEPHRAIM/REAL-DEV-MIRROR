import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LanguageSwitcher } from '../../core/i18n/language-switcher';
import { translate } from '../../core/i18n/translate';
import { ThemeToggle } from '../../core/theme/theme-toggle';

/** Mise en page des pages publiques d'authentification : carte centrée, logo, thème. */
@Component({
  selector: 'dm-auth-layout',
  imports: [RouterOutlet, RouterLink, ThemeToggle, LanguageSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-muted/40 text-foreground flex min-h-dvh flex-col">
      <header class="flex h-14 items-center justify-between px-4 md:px-6">
        <a routerLink="/login" class="flex items-center gap-2 font-semibold">
          <!-- Logo (icône Lucide « scan-face ») en SVG direct : importer @ng-icons/lucide ici
               ferait entrer toutes les icônes de l'application dans le bundle initial. -->
          <svg
            class="text-primary size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
          </svg>
          DevMirror
        </a>
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
