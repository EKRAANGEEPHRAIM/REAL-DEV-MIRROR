import { compareText, formatDate, formatRelative } from './format';
import { applyLanguage } from './language';
import { setLanguage } from './translate';

describe('mise en forme selon la langue', () => {
  const now = new Date(2026, 9, 29, 12, 0);

  afterEach(() => applyLanguage('fr', false));

  it('formate les dates en français puis en anglais', async () => {
    const date = new Date(2026, 9, 29);
    expect(formatDate(date, { day: 'numeric', month: 'long' })).toBe('29 octobre');

    await setLanguage('en', false);
    expect(formatDate(date, { day: 'numeric', month: 'long' })).toBe('29 October');
  });

  it('exprime une date relative dans la langue courante', async () => {
    const threeDaysAgo = new Date(2026, 9, 26, 12, 0);
    expect(formatRelative(threeDaysAgo, now)).toBe('il y a 3 jours');
    expect(formatRelative(new Date(2026, 9, 29, 11, 59, 40), now)).toBe('à l’instant');

    await setLanguage('en', false);
    expect(formatRelative(threeDaysAgo, now)).toBe('3 days ago');
    expect(formatRelative(now, now)).toBe('just now');
  });

  it('trie en tenant compte des accents', () => {
    expect(['zeta', 'été', 'alpha'].sort(compareText)).toEqual(['alpha', 'été', 'zeta']);
  });
});
