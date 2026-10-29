import { TestBed } from '@angular/core/testing';
import { applyLanguage, currentLanguage, LANGUAGE_STORAGE_KEY } from './language';
import { LanguageSwitcher } from './language-switcher';
import { loadLanguage } from './translate';

describe('LanguageSwitcher', () => {
  afterEach(() => {
    applyLanguage('fr', false);
    localStorage.clear();
  });

  it('passe en anglais au clic et mémorise ce choix sur l’appareil', async () => {
    await loadLanguage('en');
    const fixture = TestBed.createComponent(LanguageSwitcher);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const [frButton, enButton] = Array.from(element.querySelectorAll('button'));
    expect(frButton.getAttribute('aria-pressed')).toBe('true');

    enButton.click();
    await Promise.resolve();
    await fixture.whenStable();

    expect(currentLanguage()).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(enButton.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Language');
  });
});
