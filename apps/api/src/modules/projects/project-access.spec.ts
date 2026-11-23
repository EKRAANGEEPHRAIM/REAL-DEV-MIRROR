import { ProjectRole } from '../../generated/prisma/client.js';
import {
  canEdit,
  editableProjects,
  editableTasks,
  roleOf,
  visibleProjects,
  visibleTasks,
} from './project-access.js';

describe('règles d’accès aux projets partagés', () => {
  it('un projet est visible par son propriétaire et par ses membres', () => {
    expect(visibleProjects('u1')).toEqual({
      OR: [{ userId: 'u1' }, { members: { some: { userId: 'u1' } } }],
    });
  });

  it('seuls le propriétaire et les éditeurs peuvent écrire (pas les lecteurs)', () => {
    expect(editableProjects('u1')).toEqual({
      OR: [{ userId: 'u1' }, { members: { some: { userId: 'u1', role: ProjectRole.EDITOR } } }],
    });
  });

  it('une tâche sans projet reste privée ; une tâche de projet suit les droits du projet', () => {
    expect(visibleTasks('u1')).toEqual({
      OR: [{ userId: 'u1', projectId: null }, { project: visibleProjects('u1') }],
    });
    expect(editableTasks('u1')).toEqual({
      OR: [{ userId: 'u1', projectId: null }, { project: editableProjects('u1') }],
    });
  });

  it('roleOf : propriétaire, rôle de membre, ou aucun accès', () => {
    expect(roleOf('u1', { userId: 'u1', members: [] })).toBe('OWNER');
    expect(roleOf('u1', { userId: 'u2', members: [{ role: ProjectRole.VIEWER }] })).toBe(
      ProjectRole.VIEWER,
    );
    expect(roleOf('u1', { userId: 'u2', members: [] })).toBeNull();
  });

  it('canEdit : propriétaire et éditeur oui, lecteur et inconnu non', () => {
    expect(canEdit('OWNER')).toBe(true);
    expect(canEdit(ProjectRole.EDITOR)).toBe(true);
    expect(canEdit(ProjectRole.VIEWER)).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});
