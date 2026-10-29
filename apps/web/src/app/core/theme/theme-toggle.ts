import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { type TranslationKey, translate } from '../i18n/translate';
import { ThemeMode, ThemeStore } from './theme.store';

interface ThemeOption {
  readonly mode: ThemeMode;
  readonly label: TranslationKey;
  readonly icon: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { mode: 'light', label: 'layout.theme.light', icon: 'lucideSun' },
  { mode: 'dark', label: 'layout.theme.dark', icon: 'lucideMoon' },
  { mode: 'system', label: 'layout.theme.system', icon: 'lucideMonitor' },
];

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
      [attr.aria-label]="t('layout.changeTheme')"
    >
      <ng-icon [name]="theme.isDark() ? 'lucideMoon' : 'lucideSun'" class="text-lg" />
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-40">
        @for (option of options; track option.mode) {
          <button hlmDropdownMenuItem (triggered)="theme.setMode(option.mode)">
            <ng-icon [name]="option.icon" aria-hidden="true" />
            {{ t(option.label) }}
            @if (theme.mode() === option.mode) {
              <ng-icon
                name="lucideCheck"
                class="ms-auto"
                [attr.aria-label]="t('common.selected')"
              />
            }
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeStore);
  protected readonly options = THEME_OPTIONS;
  protected readonly t = translate;
}
