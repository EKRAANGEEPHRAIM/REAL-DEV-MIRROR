import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

describe('ThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('démarre en mode système par défaut', () => {
    const store = TestBed.inject(ThemeStore);

    expect(store.mode()).toBe('system');
  });

  it('applique la classe dark sur <html> et mémorise le choix', () => {
    const store = TestBed.inject(ThemeStore);

    store.setMode('dark');
    TestBed.tick();

    expect(store.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('relit le mode mémorisé au démarrage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const store = TestBed.inject(ThemeStore);
    TestBed.tick();

    expect(store.mode()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignore une valeur mémorisée invalide', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'violet');

    expect(TestBed.inject(ThemeStore).mode()).toBe('system');
  });
});
