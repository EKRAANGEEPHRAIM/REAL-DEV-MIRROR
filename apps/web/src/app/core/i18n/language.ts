import { signal } from '@angular/core';

export type Language = 'fr' | 'en';
export const LANGUAGES: readonly Language[] = ['fr', 'en'];
export const LANGUAGE_STORAGE_KEY = 'devmirror.language';

export function isLanguage(value: unknown): value is Language {
  return value === 'fr' || value === 'en';
}

function readStored(): Language | null {
  try {
    const value = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Langue de l'interface. Signal global (et non service) : les fonctions pures de mise en forme
 * (dates, échéances, graphiques) la lisent aussi, et tout ce qui l'a lue se met à jour quand
 * elle change. Français par défaut : l'application est d'abord francophone.
 */
export const currentLanguage = signal<Language>('fr');

/** Choix explicite déjà mémorisé sur cet appareil (sélecteur des pages publiques, Paramètres). */
export function storedLanguage(): Language | null {
  return readStored();
}

/** Locale Intl correspondante (dates, nombres, ordre alphabétique). */
export function intlLocale(): string {
  return currentLanguage() === 'en' ? 'en-GB' : 'fr-FR';
}

export function applyLanguage(language: Language, remember = true): void {
  currentLanguage.set(language);
  globalThis.document?.documentElement?.setAttribute('lang', language);
  if (!remember) return;
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Stockage indisponible (navigation privée) : la langue vaut pour la session.
  }
}
