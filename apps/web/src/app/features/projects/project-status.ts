import type { ProjectStatus } from '@devmirror/api-client';
import type { TranslationKey } from '../../core/i18n/translate';

export interface ProjectStatusOption {
  readonly value: ProjectStatus;
  /** Clé de traduction du libellé. */
  readonly label: TranslationKey;
  /** Classes Tailwind de la pastille (fond + texte), lisibles en clair et en sombre. */
  readonly tone: string;
}

export const PROJECT_STATUSES: readonly ProjectStatusOption[] = [
  {
    value: 'IDEA',
    label: 'projects.status.IDEA',
    tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  {
    value: 'IN_PROGRESS',
    label: 'projects.status.IN_PROGRESS',
    tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  },
  {
    value: 'PAUSED',
    label: 'projects.status.PAUSED',
    tone: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  },
  {
    value: 'DONE',
    label: 'projects.status.DONE',
    tone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  },
  { value: 'ARCHIVED', label: 'projects.status.ARCHIVED', tone: 'bg-muted text-muted-foreground' },
];

export function projectStatus(value: ProjectStatus): ProjectStatusOption {
  return PROJECT_STATUSES.find((status) => status.value === value) ?? PROJECT_STATUSES[0];
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return PROJECT_STATUSES.some((status) => status.value === value);
}
