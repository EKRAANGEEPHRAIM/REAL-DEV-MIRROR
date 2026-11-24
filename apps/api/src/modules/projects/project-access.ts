import { type Prisma, ProjectRole } from '../../generated/prisma/client.js';

/**
 * Règles d'accès aux projets partagés, réunies ici pour qu'aucun service ne les réécrive.
 *
 * - Le propriétaire (`Project.userId`) a tous les droits.
 * - Un membre ÉDITEUR modifie le projet et ses tâches.
 * - Un membre LECTEUR consulte seulement.
 * - Une tâche sans projet reste personnelle : seul son auteur la voit et la modifie.
 */

/** Rôle vu par l'utilisateur connecté, propriétaire compris. */
export type AccessRole = 'OWNER' | ProjectRole;

export const ACCESS_ROLES: readonly AccessRole[] = [
  'OWNER',
  ProjectRole.EDITOR,
  ProjectRole.VIEWER,
];

/** Projets que l'utilisateur peut voir : les siens et ceux dont il est membre. */
export function visibleProjects(userId: string): Prisma.ProjectWhereInput {
  return { OR: [{ userId }, { members: { some: { userId } } }] };
}

/** Projets que l'utilisateur peut modifier : les siens et ceux où il est éditeur. */
export function editableProjects(userId: string): Prisma.ProjectWhereInput {
  return { OR: [{ userId }, { members: { some: { userId, role: ProjectRole.EDITOR } } }] };
}

/** Tâches visibles : ses tâches personnelles et toutes celles des projets visibles. */
export function visibleTasks(userId: string): Prisma.TaskWhereInput {
  return { OR: [{ userId, projectId: null }, { project: visibleProjects(userId) }] };
}

/** Tâches modifiables : ses tâches personnelles et celles des projets où il peut écrire. */
export function editableTasks(userId: string): Prisma.TaskWhereInput {
  return { OR: [{ userId, projectId: null }, { project: editableProjects(userId) }] };
}

/** Rôle de l'utilisateur sur un projet chargé avec `memberRoleInclude(userId)`. */
export function roleOf(
  userId: string,
  project: { userId: string; members: readonly { role: ProjectRole }[] },
): AccessRole | null {
  if (project.userId === userId) return 'OWNER';
  return project.members[0]?.role ?? null;
}

/** À inclure dans une requête de projet pour pouvoir appeler `roleOf`. */
export function memberRoleInclude(userId: string) {
  return {
    where: { userId },
    select: { role: true },
    take: 1,
  } satisfies Prisma.Project$membersArgs;
}

export const canEdit = (role: AccessRole | null): boolean =>
  role === 'OWNER' || role === ProjectRole.EDITOR;
