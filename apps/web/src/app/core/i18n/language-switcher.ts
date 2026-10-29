import { ChangeDetectionStrategy, Component } from '@angular/core';
import { currentLanguage, type Language } from './language';
import { setLanguage, translate } from './translate';

/** Sélecteur FR / EN des pages publiques (sans compte, la langue est mémorisée sur l'appareil). */
@Component({
  selector: 'dm-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center rounded-md border p-0.5 text-xs"
      role="group"
      [attr.aria-label]="t('layout.language')"
    >
      @for (option of options; track option.value) {
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          [class.bg-accent]="language() === option.value"
          [class.text-muted-foreground]="language() !== option.value"
          [attr.aria-pressed]="language() === option.value"
          [attr.lang]="option.value"
          [attr.aria-label]="option.name"
          (click)="select(option.value)"
        >
          {{ option.short }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  protected readonly language = currentLanguage;
  protected readonly t = translate;
  /** Noms dans leur propre langue : on reconnaît la sienne même sans la comprendre. */
  protected readonly options: readonly { value: Language; short: string; name: string }[] = [
    { value: 'fr', short: 'FR', name: 'Français' },
    { value: 'en', short: 'EN', name: 'English' },
  ];

  protected select(language: Language): void {
    void setLanguage(language);
  }
}
