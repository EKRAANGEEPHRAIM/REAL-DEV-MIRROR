export const EXCERPT_LENGTH = 200;

/**
 * Extrait en texte brut d'un contenu Markdown, pour les listes : blocs de code, images,
 * balises et ponctuation de mise en forme retirés, liens réduits à leur texte.
 */
export function noteExcerpt(markdown: string, length = EXCERPT_LENGTH): string {
  const text = markdown
    .replace(/```[\s\S]*?(```|$)/g, ' ') // blocs de code (même non refermés)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // liens -> texte
    .replace(/<[^>]+>/g, ' ') // HTML
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // titres, citations, listes
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ') // séparateurs
    .replace(/[*_~`]+/g, '') // emphase, code en ligne
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > length * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
