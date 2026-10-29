import { en } from './en';
import { fr } from './fr';
import { applyLanguage, currentLanguage, LANGUAGE_STORAGE_KEY } from './language';
import { setLanguage, type TranslationKey, translate } from './translate';

/** Toutes les feuilles d'un dictionnaire, par chemin (« projects.empty.title » → texte). */
function leaves(node: object, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result.set(path, value);
    else for (const [k, v] of leaves(value as object, path)) result.set(k, v);
  }
  return result;
}

describe('translate', () => {
  afterEach(() => {
    applyLanguage('fr', false);
    localStorage.clear();
  });

  it('traduit en français par défaut, avec ses paramètres', () => {
    expect(currentLanguage()).toBe('fr');
    expect(translate('projects.toast.created', { name: 'DevMirror' })).toBe(
      'Projet « DevMirror » créé',
    );
  });

  it('accorde selon les règles françaises : 0 et 1 au singulier', () => {
    expect(translate('projects.count', { count: 0 })).toBe('0 projet');
    expect(translate('projects.count', { count: 1 })).toBe('1 projet');
    expect(translate('projects.count', { count: 2 })).toBe('2 projets');
  });

  it('bascule en anglais, avec les règles de pluriel anglaises', async () => {
    await setLanguage('en');

    expect(translate('projects.count', { count: 0 })).toBe('0 projects');
    expect(translate('projects.count', { count: 1 })).toBe('1 project');
    expect(translate('titles.dashboard')).toBe('Dashboard');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('ne mémorise pas la langue quand on le demande (langue du compte)', async () => {
    await setLanguage('en', false);
    expect(currentLanguage()).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('laisse visibles une clé inconnue et un paramètre absent', () => {
    expect(translate('nope.missing' as TranslationKey)).toBe('nope.missing');
    expect(translate('palette.goTo')).toBe('Aller à : {page}');
  });

  it('le dictionnaire anglais couvre chaque texte, avec les mêmes paramètres et pluriels', () => {
    const french = leaves(fr);
    const english = leaves(en);
    expect([...english.keys()].sort()).toEqual([...french.keys()].sort());

    const params = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
    for (const [key, text] of french) {
      const translated = english.get(key) ?? '';
      expect(translated.trim(), key).not.toBe('');
      expect(params(translated), key).toEqual(params(text));
      expect(translated.includes('|'), key).toBe(text.includes('|'));
    }
  });
});
