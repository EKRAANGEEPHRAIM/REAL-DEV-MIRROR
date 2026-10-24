import { applyFormat } from './markdown-format';

/** Texte avec la sélection marquée par [ et ] après l'édition. */
function show({ text, start, end }: { text: string; start: number; end: number }): string {
  return `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`;
}

describe('applyFormat', () => {
  it('met la sélection en gras, puis enlève le gras', () => {
    const bold = applyFormat('un mot ici', 3, 6, 'bold');
    expect(show(bold)).toBe('un **[mot]** ici');
    expect(show(applyFormat(bold.text, bold.start, bold.end, 'bold'))).toBe('un [mot] ici');
  });

  it('sans sélection, insère un texte à remplacer, sélectionné', () => {
    expect(show(applyFormat('a ', 2, 2, 'code'))).toBe('a `[code]`');
    expect(show(applyFormat('', 0, 0, 'italic'))).toBe('_[texte en italique]_');
  });

  it('crée un lien en sélectionnant l’URL', () => {
    expect(show(applyFormat('voir doc', 5, 8, 'link'))).toBe('voir [doc]([https://])');
  });

  it('préfixe chaque ligne touchée, et retire le préfixe si toutes l’ont déjà', () => {
    const text = 'intro\nun\ndeux\nfin';
    // sélection de « n » (ligne 2) à « de » (ligne 3)
    const list = applyFormat(text, 7, 12, 'list');
    expect(list.text).toBe('intro\n- un\n- deux\nfin');
    expect(applyFormat(list.text, list.start, list.end, 'list').text).toBe(text);
    expect(applyFormat('Titre', 2, 2, 'heading').text).toBe('## Titre');
  });

  it('place un bloc de code sur ses propres lignes', () => {
    expect(show(applyFormat('avant x après', 6, 7, 'codeblock'))).toBe(
      'avant \n```\n[x]\n```\n après',
    );
  });
});
