import { translate } from '../../core/i18n/translate';

/** Titre donné aux notes créées vides, dans la langue courante (enregistré tel quel en base). */
export function untitledNote(): string {
  return translate('notes.untitled');
}

/** Titres par défaut de toutes les langues : l'éditeur les sélectionne pour qu'on les remplace. */
export const UNTITLED_TITLES: readonly string[] = ['Sans titre', 'Untitled'];
