import { fr } from './fr';
import { applyLanguage, currentLanguage, type Language } from './language';

/** Même arborescence que le français, chaque feuille étant une chaîne quelconque. */
export type Translations<T = typeof fr> = {
  [K in keyof T]: T[K] extends string ? string : Translations<T[K]>;
};

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

/** Clé de traduction vérifiée à la compilation (« projects.empty.title »…). */
export type TranslationKey = Leaves<typeof fr>;
export type TranslationParams = Record<string, string | number>;

// Le français est embarqué ; l'anglais n'est téléchargé que si on le choisit.
const dictionaries: Partial<Record<Language, Translations>> = { fr };

export async function loadLanguage(language: Language): Promise<void> {
  if (!dictionaries[language]) dictionaries[language] = (await import('./en')).en;
}

/** Charge le dictionnaire puis bascule l'interface (sans flash de clés non traduites). */
export async function setLanguage(language: Language, remember = true): Promise<void> {
  await loadLanguage(language);
  applyLanguage(language, remember);
}

function lookup(dictionary: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      dictionary,
    );
  return typeof value === 'string' ? value : undefined;
}

const pluralRules = new Map<Language, Intl.PluralRules>();

/**
 * « singulier|pluriel » : choisi avec les règles de la langue (en français, 0 et 1 sont au
 * singulier ; en anglais, seul 1 l'est).
 */
function pickPlural(template: string, count: unknown, language: Language): string {
  const separator = template.indexOf('|');
  if (separator < 0 || typeof count !== 'number') return template;
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(language);
    pluralRules.set(language, rules);
  }
  return rules.select(count) === 'one'
    ? template.slice(0, separator)
    : template.slice(separator + 1);
}

/**
 * Texte traduit dans la langue courante, avec ses paramètres ({name}, {count}…). Lit le
 * signal de langue : un template ou un computed qui l'appelle se met à jour quand elle change.
 */
export function translate(key: TranslationKey, params?: TranslationParams): string {
  const language = currentLanguage();
  const template = lookup(dictionaries[language] ?? fr, key) ?? lookup(fr, key) ?? key;
  const text = pickPlural(template, params?.['count'], language);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
