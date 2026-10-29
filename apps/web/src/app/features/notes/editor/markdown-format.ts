import { type TranslationKey, translate } from '../../../core/i18n/translate';

/** Mise en forme appliquée à la sélection d'un <textarea> Markdown. */
export type MarkdownFormat =
  'bold' | 'italic' | 'code' | 'link' | 'heading' | 'list' | 'quote' | 'codeblock';

export interface TextEdit {
  text: string;
  /** Nouvelle sélection après l'édition. */
  start: number;
  end: number;
}

/** placeholder : clé du texte d'exemple inséré quand rien n'est sélectionné (dans la langue courante). */
const INLINE: Partial<Record<MarkdownFormat, { marker: string; placeholder: TranslationKey }>> = {
  bold: { marker: '**', placeholder: 'notes.format.sample.bold' },
  italic: { marker: '_', placeholder: 'notes.format.sample.italic' },
  code: { marker: '`', placeholder: 'notes.format.sample.code' },
};

const LINE_PREFIX: Partial<Record<MarkdownFormat, string>> = {
  heading: '## ',
  list: '- ',
  quote: '> ',
};

export const FORMAT_ACTIONS: readonly {
  format: MarkdownFormat;
  label: TranslationKey;
  icon: string;
  shortcut?: string;
}[] = [
  { format: 'heading', label: 'notes.format.heading', icon: 'lucideHeading2' },
  { format: 'bold', label: 'notes.format.bold', icon: 'lucideBold', shortcut: 'Ctrl+B' },
  { format: 'italic', label: 'notes.format.italic', icon: 'lucideItalic', shortcut: 'Ctrl+I' },
  { format: 'code', label: 'notes.format.code', icon: 'lucideCode' },
  { format: 'codeblock', label: 'notes.format.codeblock', icon: 'lucideSquareCode' },
  { format: 'link', label: 'notes.format.link', icon: 'lucideLink' },
  { format: 'list', label: 'notes.format.list', icon: 'lucideList' },
  { format: 'quote', label: 'notes.format.quote', icon: 'lucideQuote' },
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
  if (inline) return toggleInline(text, start, end, inline.marker, translate(inline.placeholder));

  const prefix = LINE_PREFIX[format];
  if (prefix) return toggleLinePrefix(text, start, end, prefix);

  if (format === 'link') {
    const label = selected || translate('notes.format.sample.link');
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
  const body = selected || translate('notes.format.sample.code');
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
