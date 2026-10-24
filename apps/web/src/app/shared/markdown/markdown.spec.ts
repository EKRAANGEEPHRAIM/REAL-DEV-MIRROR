import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('rend le Markdown GFM (titres, emphase, tableaux, listes de tâches)', () => {
    const html = renderMarkdown(
      '# Titre\n\n**gras** et _italique_\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] fait',
    );
    expect(html).toContain('<h1>Titre</h1>');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<em>italique</em>');
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
  });

  it('retire scripts, gestionnaires d’événements et liens javascript:', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[clic](javascript:alert(3))',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('ouvre les liens dans un nouvel onglet, sans accès à la page d’origine', () => {
    const html = renderMarkdown('[DevMirror](https://devmirror.dev)');
    expect(html).toContain('href="https://devmirror.dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('colore le code d’un langage connu et échappe celui d’un langage inconnu', () => {
    const ts = renderMarkdown('```ts\nconst answer: number = 42;\n```');
    expect(ts).toContain('class="hljs language-ts"');
    expect(ts).toContain('<span class="hljs-keyword">const</span>');

    const unknown = renderMarkdown('```brainfuck\n<div>pas du HTML</div>\n```');
    expect(unknown).toContain('&lt;div&gt;pas du HTML&lt;/div&gt;');
    expect(unknown).not.toContain('<div>pas');
  });
});
