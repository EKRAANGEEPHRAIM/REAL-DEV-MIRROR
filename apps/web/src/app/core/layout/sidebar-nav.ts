import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFolderKanban,
  lucideLayoutDashboard,
  lucideNotebookPen,
  lucideSettings,
  lucideSquareCheckBig,
  lucideTarget,
} from '@ng-icons/lucide';
import { NavItem } from './navigation';

@Component({
  selector: 'dm-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [
    provideIcons({
      lucideFolderKanban,
      lucideLayoutDashboard,
      lucideNotebookPen,
      lucideSettings,
      lucideSquareCheckBig,
      lucideTarget,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="label()" class="flex flex-col gap-1">
      @for (item of items(); track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="bg-accent text-accent-foreground"
          #link="routerLinkActive"
          [class.text-muted-foreground]="!link.isActive"
          [attr.aria-current]="link.isActive ? 'page' : null"
          class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
          (click)="navigated.emit()"
        >
          <ng-icon [name]="item.icon" class="text-base" aria-hidden="true" />
          {{ item.label }}
        </a>
      }
    </nav>
  `,
})
export class SidebarNav {
  readonly items = input.required<readonly NavItem[]>();
  readonly label = input('Navigation');
  /** Émis après un clic sur un lien, pour fermer le menu mobile. */
  readonly navigated = output<void>();
}
