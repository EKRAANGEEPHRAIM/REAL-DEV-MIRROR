import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { ThemeMode, ThemeStore } from './theme.store';

interface ThemeOption {
  readonly mode: ThemeMode;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'dm-theme-toggle',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideCheck, lucideMonitor, lucideMoon, lucideSun })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      hlmBtn
      variant="ghost"
      size="icon"
      [hlmDropdownMenuTrigger]="menu"
      align="end"
      aria-label="Changer le thème"
    >
      <ng-icon [name]="theme.isDark() ? 'lucideMoon' : 'lucideSun'" class="text-lg" />
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-40">
        @for (option of options; track option.mode) {
          <button hlmDropdownMenuItem (triggered)="theme.setMode(option.mode)">
            <ng-icon [name]="option.icon" aria-hidden="true" />
            {{ option.label }}
            @if (theme.mode() === option.mode) {
              <ng-icon name="lucideCheck" class="ms-auto" aria-label="Sélectionné" />
            }
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeStore);
  protected readonly options: readonly ThemeOption[] = [
    { mode: 'light', label: 'Clair', icon: 'lucideSun' },
    { mode: 'dark', label: 'Sombre', icon: 'lucideMoon' },
    { mode: 'system', label: 'Système', icon: 'lucideMonitor' },
  ];
}
