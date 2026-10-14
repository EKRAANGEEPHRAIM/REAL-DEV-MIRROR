import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { ThemeStore } from './core/theme/theme.store';

@Component({
  selector: 'dm-root',
  imports: [RouterOutlet, HlmToasterImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <hlm-toaster [theme]="theme.isDark() ? 'dark' : 'light'" />
  `,
})
export class App {
  // Injecté dès le démarrage pour appliquer le thème mémorisé.
  protected readonly theme = inject(ThemeStore);
}
