import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { UserPreferences } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSlidersHorizontal, lucideSun } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AccountApi } from '../../../core/account/account.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { apiErrorMessage } from '../../../core/http/api-error';
import { type ThemeMode, ThemeStore } from '../../../core/theme/theme.store';

const THEMES: readonly { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: 'lucideSun' },
  { value: 'dark', label: 'Sombre', icon: 'lucideMoon' },
  { value: 'system', label: 'Système', icon: 'lucideMonitor' },
];

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2';

/** Thème (appliqué aussitôt, enregistré dans le compte) et langue de l'interface. */
@Component({
  selector: 'dm-preferences-settings',
  imports: [NgIcon, HlmLabelImports],
  providers: [provideIcons({ lucideMonitor, lucideMoon, lucideSlidersHorizontal, lucideSun })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="preferences-heading" class="rounded-xl border p-5">
      <h2 id="preferences-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideSlidersHorizontal" aria-hidden="true" />
        Préférences
      </h2>

      <fieldset class="mt-4">
        <legend class="mb-2 text-sm font-medium">Thème</legend>
        <div class="grid max-w-md grid-cols-3 gap-2">
          @for (theme of themes; track theme.value) {
            <label
              class="has-[:focus-visible]:ring-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)] has-[:focus-visible]:ring-2"
            >
              <input
                type="radio"
                name="theme"
                class="sr-only"
                [value]="theme.value"
                [checked]="themeStore.mode() === theme.value"
                (change)="themeStore.setMode(theme.value)"
              />
              <ng-icon [name]="theme.icon" class="text-lg" aria-hidden="true" />
              {{ theme.label }}
            </label>
          }
        </div>
        <p class="text-muted-foreground mt-2 text-xs">
          Enregistré dans votre compte : il vous suit sur vos autres appareils.
        </p>
      </fieldset>

      <div class="mt-6 flex flex-col gap-2">
        <label hlmLabel for="language">Langue de l’interface</label>
        <select
          id="language"
          [class]="selectClasses + ' w-fit'"
          [disabled]="savingLanguage()"
          (change)="setLanguage($any($event.target).value)"
        >
          <option value="fr" [selected]="language() === 'fr'">Français</option>
          <!-- Activée avec la traduction de l'interface -->
          <option value="en" [selected]="language() === 'en'" disabled>English (bientôt)</option>
        </select>
      </div>
    </section>
  `,
})
export class PreferencesSettings {
  protected readonly themeStore = inject(ThemeStore);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(AccountApi);

  protected readonly themes = THEMES;
  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly savingLanguage = signal(false);

  protected language(): UserPreferences['language'] {
    return this.auth.user()?.preferences.language ?? 'fr';
  }

  protected setLanguage(language: UserPreferences['language']): void {
    if (language === this.language()) return;
    this.savingLanguage.set(true);
    this.api.updateProfile({ preferences: { language } }).subscribe({
      next: (user) => {
        this.savingLanguage.set(false);
        this.auth.setUser(user);
        toast.success(language === 'en' ? 'Language saved' : 'Langue enregistrée');
      },
      error: (error: unknown) => {
        this.savingLanguage.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }
}
