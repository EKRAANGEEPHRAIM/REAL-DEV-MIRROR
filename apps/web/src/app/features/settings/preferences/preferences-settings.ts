import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSlidersHorizontal, lucideSun } from '@ng-icons/lucide';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { currentLanguage, isLanguage } from '../../../core/i18n/language';
import { setLanguage, translate } from '../../../core/i18n/translate';
import { ThemeStore } from '../../../core/theme/theme.store';
import { THEME_OPTIONS } from '../../../core/theme/theme-toggle';

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/**
 * Thème et langue de l'interface, appliqués aussitôt. L'enregistrement dans le compte est fait
 * par ThemePreferenceSync et LanguagePreferenceSync (démarrés par le shell).
 */
@Component({
  selector: 'dm-preferences-settings',
  imports: [NgIcon, HlmLabelImports],
  providers: [provideIcons({ lucideMonitor, lucideMoon, lucideSlidersHorizontal, lucideSun })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="preferences-heading" class="rounded-xl border p-5">
      <h2 id="preferences-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideSlidersHorizontal" aria-hidden="true" />
        {{ t('settings.preferences.title') }}
      </h2>

      <fieldset class="mt-4">
        <legend class="mb-2 text-sm font-medium">{{ t('settings.preferences.theme') }}</legend>
        <div class="grid max-w-md grid-cols-3 gap-2">
          @for (theme of themes; track theme.mode) {
            <label
              class="has-[:focus-visible]:ring-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)] has-[:focus-visible]:ring-2"
            >
              <input
                type="radio"
                name="theme"
                class="sr-only"
                [value]="theme.mode"
                [checked]="themeStore.mode() === theme.mode"
                (change)="themeStore.setMode(theme.mode)"
              />
              <ng-icon [name]="theme.icon" class="text-lg" aria-hidden="true" />
              {{ t(theme.label) }}
            </label>
          }
        </div>
        <p class="text-muted-foreground mt-2 text-xs">{{ t('settings.preferences.synced') }}</p>
      </fieldset>

      <div class="mt-6 flex flex-col gap-2">
        <label hlmLabel for="language">{{ t('settings.preferences.language') }}</label>
        <select
          id="language"
          [class]="selectClasses + ' w-fit'"
          (change)="setLanguage($any($event.target).value)"
        >
          <!-- Noms dans leur propre langue : chacun reconnaît la sienne. -->
          <option value="fr" lang="fr" [selected]="language() === 'fr'">Français</option>
          <option value="en" lang="en" [selected]="language() === 'en'">English</option>
        </select>
      </div>
    </section>
  `,
})
export class PreferencesSettings {
  protected readonly themeStore = inject(ThemeStore);
  protected readonly themes = THEME_OPTIONS;
  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly language = currentLanguage;
  protected readonly t = translate;

  protected setLanguage(value: string): void {
    if (isLanguage(value)) void setLanguage(value);
  }
}
