/** Mise en forme appliquée à la sélection d'un <textarea> Markdown. */
export type MarkdownFormat =
  'bold' | 'italic' | 'code' | 'link' | 'heading' | 'list' | 'quote' | 'codeblock';

export interface TextEdit {
  text: string;
  /** Nouvelle sélection après l'édition. */
  start: number;
  end: number;
}

const INLINE: Partial<Record<MarkdownFormat, { marker: string; placeholder: string }>> = {
  bold: { marker: '**', placeholder: 'texte en gras' },
  italic: { marker: '_', placeholder: 'texte en italique' },
  code: { marker: '`', placeholder: 'code' },
};

const LINE_PREFIX: Partial<Record<MarkdownFormat, string>> = {
  heading: '## ',
  list: '- ',
  quote: '> ',
};

export const FORMAT_ACTIONS: readonly {
  format: MarkdownFormat;
  label: string;
  icon: string;
  shortcut?: string;
}[] = [
  { format: 'heading', label: 'Titre', icon: 'lucideHeading2' },
  { format: 'bold', label: 'Gras', icon: 'lucideBold', shortcut: 'Ctrl+B' },
  { format: 'italic', label: 'Italique', icon: 'lucideItalic', shortcut: 'Ctrl+I' },
  { format: 'code', label: 'Code en ligne', icon: 'lucideCode' },
  { format: 'codeblock', label: 'Bloc de code', icon: 'lucideSquareCode' },
  { format: 'link', label: 'Lien', icon: 'lucideLink' },
  { format: 'list', label: 'Liste', icon: 'lucideList' },
  { format: 'quote', label: 'Citation', icon: 'lucideQuote' },
];

/**
 * Applique un format à text[start, end). Gras, italique et code s'enlèvent s'ils entourent
 * déjà la sélection ; titres, listes et citations s'appliquent à chaque ligne touchée.
 */
export function applyFormat(
  text: string,
  start: number,
  end: number,
  format: MarkdownFormat,
): TextEdit {
  const selected = text.slice(start, end);
  const inline = INLINE[format];
  if (inline) return toggleInline(text, start, end, inline.marker, inline.placeholder);

  const prefix = LINE_PREFIX[format];
  if (prefix) return toggleLinePrefix(text, start, end, prefix);

  if (format === 'link') {
    const label = selected || 'texte du lien';
    const inserted = `[${label}](https://)`;
    const urlStart = start + label.length + 3;
    return {
      text: text.slice(0, start) + inserted + text.slice(end),
      start: urlStart,
      end: urlStart + 'https://'.length,
    };
  }

  // Bloc de code : sur ses propres lignes.
  const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const after = end < text.length && text[end] !== '\n' ? '\n' : '';
  const body = selected || 'code';
  const inserted = `${before}\`\`\`\n${body}\n\`\`\`${after}`;
  const bodyStart = start + before.length + 4;
  return {
    text: text.slice(0, start) + inserted + text.slice(end),
    start: bodyStart,
    end: bodyStart + body.length,
  };
}

function toggleInline(
  text: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): TextEdit {
  const m = marker.length;
  const wrapped =
    text.slice(start - m, start) === marker && text.slice(end, end + m) === marker && start >= m;
  if (wrapped) {
    return {
      text: text.slice(0, start - m) + text.slice(start, end) + text.slice(end + m),
      start: start - m,
      end: end - m,
    };
  }
  const body = text.slice(start, end) || placeholder;
  return {
    text: text.slice(0, start) + marker + body + marker + text.slice(end),
    start: start + m,
    end: start + m + body.length,
  };
}

function toggleLinePrefix(text: string, start: number, end: number, prefix: string): TextEdit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;

  const lines = text.slice(lineStart, lineEnd).split('\n');
  const remove = lines.every((line) => line.startsWith(prefix));
  const updated = lines
    .map((line) => (remove ? line.slice(prefix.length) : prefix + line))
    .join('\n');

  return {
    text: text.slice(0, lineStart) + updated + text.slice(lineEnd),
    start: lineStart,
    end: lineStart + updated.length,
  };
}
