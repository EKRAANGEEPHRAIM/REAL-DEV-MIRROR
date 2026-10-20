import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu, lucideScanFace } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { ThemeToggle } from '../theme/theme-toggle';
import { MAIN_NAV, SECONDARY_NAV } from './navigation';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/** Mise en page de l'espace connecté : barre latérale (bureau), menu tiroir (mobile), barre du haut. */
@Component({
  selector: 'dm-shell',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmSheetImports,
    SidebarNav,
    ThemeToggle,
    UserMenu,
  ],
  providers: [provideIcons({ lucideMenu, lucideScanFace })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      href="#contenu"
      class="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Aller au contenu
    </a>

    <div class="bg-background text-foreground flex min-h-dvh">
      <aside
        class="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col border-r md:flex"
      >
        <ng-container *ngTemplateOutlet="brand" />
        <div class="flex flex-1 flex-col justify-between gap-4 px-3 py-4">
          <dm-sidebar-nav [items]="mainNav" label="Navigation principale" />
          <dm-sidebar-nav [items]="secondaryNav" label="Compte" />
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:px-6"
        >
          <hlm-sheet #mobileMenu="hlmSheet" side="left">
            <button
              hlmSheetTrigger
              side="left"
              hlmBtn
              variant="ghost"
              size="icon"
              class="md:hidden"
              aria-label="Ouvrir le menu"
            >
              <ng-icon name="lucideMenu" class="text-lg" />
            </button>
            <hlm-sheet-content *hlmSheetPortal class="w-72 gap-0 p-0">
              <h2 hlmSheetTitle class="sr-only">Menu</h2>
              <ng-container *ngTemplateOutlet="brand" />
              <div class="flex flex-col gap-4 px-3 py-4">
                <dm-sidebar-nav
                  [items]="mainNav"
                  label="Navigation principale"
                  (navigated)="mobileMenu.close()"
                />
                <dm-sidebar-nav
                  [items]="secondaryNav"
                  label="Compte"
                  (navigated)="mobileMenu.close()"
                />
              </div>
            </hlm-sheet-content>
          </hlm-sheet>

          <span class="font-semibold md:hidden">DevMirror</span>

          <div class="ms-auto flex items-center gap-1">
            <dm-theme-toggle />
            <dm-user-menu />
          </div>
        </header>

        <main id="contenu" tabindex="-1" class="flex-1 px-4 py-6 outline-none md:px-8">
          <router-outlet />
        </main>
      </div>
    </div>

    <ng-template #brand>
      <a routerLink="/dashboard" class="flex h-14 items-center gap-2 border-b px-5 font-semibold">
        <ng-icon name="lucideScanFace" class="text-primary text-xl" aria-hidden="true" />
        DevMirror
      </a>
    </ng-template>
  `,
})
export class Shell {
  protected readonly mainNav = MAIN_NAV;
  protected readonly secondaryNav = SECONDARY_NAV;
}
