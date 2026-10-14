export interface NavItem {
  readonly label: string;
  readonly path: string;
  /** Nom d'icône Lucide (@ng-icons/lucide), enregistrée dans SidebarNav. */
  readonly icon: string;
}

export const MAIN_NAV: readonly NavItem[] = [
  { label: 'Tableau de bord', path: '/dashboard', icon: 'lucideLayoutDashboard' },
  { label: 'Projets', path: '/projects', icon: 'lucideFolderKanban' },
  { label: 'Tâches', path: '/tasks', icon: 'lucideSquareCheckBig' },
  { label: 'Objectifs', path: '/goals', icon: 'lucideTarget' },
  { label: 'Notes', path: '/notes', icon: 'lucideNotebookPen' },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { label: 'Paramètres', path: '/settings', icon: 'lucideSettings' },
];
