import type { TranslationKey } from '../i18n/translate';

export interface NavItem {
  /** Clé de traduction du libellé (la même que le titre de la page). */
  readonly label: TranslationKey;
  readonly path: string;
  /** Nom d'icône Lucide (@ng-icons/lucide), enregistrée dans SidebarNav. */
  readonly icon: string;
}

export const MAIN_NAV: readonly NavItem[] = [
  { label: 'titles.dashboard', path: '/dashboard', icon: 'lucideLayoutDashboard' },
  { label: 'titles.projects', path: '/projects', icon: 'lucideFolderKanban' },
  { label: 'titles.tasks', path: '/tasks', icon: 'lucideSquareCheckBig' },
  { label: 'titles.goals', path: '/goals', icon: 'lucideTarget' },
  { label: 'titles.notes', path: '/notes', icon: 'lucideNotebookPen' },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { label: 'titles.settings', path: '/settings', icon: 'lucideSettings' },
];
