import type { ProjectStatus } from '@devmirror/api-client';

export interface ProjectStatusOption {
  readonly value: ProjectStatus;
  readonly label: string;
  /** Classes Tailwind de la pastille (fond + texte), lisibles en clair et en sombre. */
  readonly tone: string;
}

export const PROJECT_STATUSES: readonly ProjectStatusOption[] = [
  { value: 'IDEA', label: 'Idée', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  {
    value: 'IN_PROGRESS',
    label: 'En cours',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  { value: 'PAUSED', label: 'En pause', tone: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
  {
    value: 'DONE',
    label: 'Terminé',
    tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  { value: 'ARCHIVED', label: 'Archivé', tone: 'bg-muted text-muted-foreground' },
];

export function projectStatus(value: ProjectStatus): ProjectStatusOption {
  return PROJECT_STATUSES.find((status) => status.value === value) ?? PROJECT_STATUSES[0];
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return PROJECT_STATUSES.some((status) => status.value === value);
}
