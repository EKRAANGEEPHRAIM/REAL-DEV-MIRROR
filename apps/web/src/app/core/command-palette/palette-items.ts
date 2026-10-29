import type { SearchResults } from '@devmirror/api-client';
import { taskStatus } from '../../features/tasks/task-meta';
import { translate } from '../i18n/translate';
import { MAIN_NAV, SECONDARY_NAV } from '../layout/navigation';

/** Recherche lancée côté API à partir de ce nombre de caractères (comme l'API). */
export const MIN_SEARCH_LENGTH = 2;

export type PaletteGroup = 'actions' | 'navigation' | 'projects' | 'tasks' | 'notes';

/** Ce que fait une entrée : aller à une URL, ou une commande gérée par la palette. */
export type PaletteTarget =
  | { kind: 'link'; commands: string[]; queryParams?: Record<string, string> }
  | { kind: 'command'; command: PaletteCommand };

export type PaletteCommand = 'new-note' | 'new-project' | 'toggle-theme';

export interface PaletteItem {
  /** Unique dans la liste : sert d'id DOM pour aria-activedescendant. */
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  icon: string;
  /** Pastille de couleur (projet). */
  color?: string | null;
  target: PaletteTarget;
  /** Mots supplémentaires pris en compte par le filtre des actions. */
  keywords?: string;
}

/** Libellé affiché d'un groupe, dans la langue courante. */
export function groupLabel(group: PaletteGroup): string {
  return translate(`palette.groups.${group}`);
}

/** Actions et pages, construites à l'appel : leurs libellés suivent la langue courante. */
function commandItems(): PaletteItem[] {
  return [
    {
      id: 'cmd-new-note',
      group: 'actions',
      label: translate('palette.commands.newNote'),
      icon: 'lucideNotebookPen',
      keywords: translate('palette.keywords.newNote'),
      target: { kind: 'command', command: 'new-note' },
    },
    {
      id: 'cmd-new-project',
      group: 'actions',
      label: translate('palette.commands.newProject'),
      icon: 'lucideFolderPlus',
      keywords: translate('palette.keywords.create'),
      target: { kind: 'command', command: 'new-project' },
    },
    {
      id: 'cmd-theme',
      group: 'actions',
      label: translate('palette.commands.toggleTheme'),
      icon: 'lucideSunMoon',
      keywords: translate('palette.keywords.theme'),
      target: { kind: 'command', command: 'toggle-theme' },
    },
  ];
}

function navigationItems(): PaletteItem[] {
  return [...MAIN_NAV, ...SECONDARY_NAV].map((item) => {
    const page = translate(item.label);
    return {
      id: `nav-${item.path.slice(1)}`,
      group: 'navigation',
      label: translate('palette.goTo', { page }),
      icon: item.icon,
      keywords: page,
      target: { kind: 'link', commands: [item.path] },
    };
  });
}

/** Comparaison sans casse ni accents : « tache » trouve « Tâches ». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Actions et pages filtrées localement ; toutes affichées quand la saisie est vide. */
export function staticItems(query: string): PaletteItem[] {
  const needle = normalize(query);
  const all = [...commandItems(), ...navigationItems()];
  if (!needle) return all;
  return all.filter((item) => normalize(`${item.label} ${item.keywords ?? ''}`).includes(needle));
}

/** Résultats de l'API -> entrées de la palette, dans l'ordre projets, tâches, notes. */
export function resultItems(results: SearchResults | null): PaletteItem[] {
  if (!results) return [];
  return [
    ...results.projects.map((project): PaletteItem => ({
      id: `project-${project.id}`,
      group: 'projects',
      label: project.name,
      icon: 'lucideFolderKanban',
      color: project.color,
      target: { kind: 'link', commands: ['/projects', project.id] },
    })),
    ...results.tasks.map((task): PaletteItem => ({
      id: `task-${task.id}`,
      group: 'tasks',
      label: task.title,
      hint: [translate(taskStatus(task.status).label), task.project?.name]
        .filter(Boolean)
        .join(' · '),
      icon: task.status === 'DONE' ? 'lucideSquareCheckBig' : 'lucideSquare',
      // Pas de page de détail : la liste filtrée sur le titre.
      target: { kind: 'link', commands: ['/tasks'], queryParams: { q: task.title } },
    })),
    ...results.notes.map((note): PaletteItem => ({
      id: `note-${note.id}`,
      group: 'notes',
      label: note.title,
      hint: note.excerpt || undefined,
      icon: note.pinned ? 'lucidePin' : 'lucideStickyNote',
      target: { kind: 'link', commands: ['/notes', note.id] },
    })),
  ];
}

export interface PaletteSection {
  group: PaletteGroup;
  items: { item: PaletteItem; index: number }[];
}

/**
 * Liste complète (résultats d'abord pendant une recherche) et sections pour l'affichage ;
 * `index` est la position dans la liste plate, utilisée par la navigation au clavier.
 */
export function buildPalette(
  query: string,
  results: SearchResults | null,
): { items: PaletteItem[]; sections: PaletteSection[] } {
  const items = [...resultItems(results), ...staticItems(query)];
  const sections: PaletteSection[] = [];
  items.forEach((item, index) => {
    const last = sections.at(-1);
    if (last?.group === item.group) last.items.push({ item, index });
    else sections.push({ group: item.group, items: [{ item, index }] });
  });
  return { items, sections };
}
