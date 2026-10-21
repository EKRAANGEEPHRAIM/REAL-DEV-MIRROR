import type { CreateProjectRequest, Project, ProjectStatus } from '@devmirror/api-client';

/** Couleurs proposées dans le formulaire (lisibles sur fond clair et sombre). */
export const PROJECT_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#64748b',
] as const;

export interface ProjectFormValue {
  name: string;
  description: string;
  status: ProjectStatus;
  techStack: string;
  repoUrl: string;
  demoUrl: string;
  color: string | null;
  tagIds: string[];
}

/** "Angular, NestJS ,, angular" -> ["Angular", "NestJS"] (vides et doublons retirés). */
export function parseTechStack(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function toFormValue(project?: Project): ProjectFormValue {
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'IDEA',
    techStack: project?.techStack.join(', ') ?? '',
    repoUrl: project?.repoUrl ?? '',
    demoUrl: project?.demoUrl ?? '',
    color: project?.color ?? PROJECT_COLORS[0],
    tagIds: project?.tags.map((tag) => tag.id) ?? [],
  };
}

/** Corps envoyé à l'API ; les champs vides deviennent null pour effacer la valeur en modification. */
export function toRequest(value: ProjectFormValue): CreateProjectRequest {
  return {
    name: value.name.trim(),
    description: value.description.trim() || null,
    status: value.status,
    techStack: parseTechStack(value.techStack),
    repoUrl: value.repoUrl.trim() || null,
    demoUrl: value.demoUrl.trim() || null,
    color: value.color,
    tagIds: value.tagIds,
  };
}
