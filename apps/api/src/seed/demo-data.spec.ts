import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { DemoAccountGuard, isDemoAccount } from '../common/demo/demo-account.js';
import { buildDemoData, demoActivity } from './demo-data.js';

const now = new Date('2026-11-05T15:00:00Z');
const DAY = 86_400_000;
const daysAgo = (date: Date) => (now.getTime() - date.getTime()) / DAY;

describe('données du compte de démo', () => {
  const data = buildDemoData(now);

  it('est déterministe : deux constructions identiques pour le même instant', () => {
    expect(JSON.stringify(buildDemoData(now))).toBe(JSON.stringify(data));
  });

  it('couvre tous les écrans : projets de chaque statut, tâches, objectifs, notes, tags', () => {
    expect(new Set(data.projects.map((p) => p.status))).toEqual(
      new Set(['IN_PROGRESS', 'DONE', 'PAUSED', 'IDEA']),
    );
    expect(data.tasks.length).toBeGreaterThanOrEqual(40);
    expect(new Set(data.tasks.map((t) => t.status))).toEqual(
      new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
    );
    expect(data.goals.some((g) => g.milestones.every((m) => m.doneAt))).toBe(true);
    expect(data.notes.filter((n) => n.pinned)).toHaveLength(2);
    expect(data.tasks.some((t) => t.subtasks.length > 0)).toBe(true);
  });

  it('titres uniques : le seed retrouve les lignes créées par leur titre', () => {
    for (const list of [data.tasks, data.notes, data.goals]) {
      const titles = list.map((item) => item.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('références cohérentes : projets et tags cités existent', () => {
    const projectKeys = new Set(data.projects.map((p) => p.key));
    const tagNames = new Set(data.tags.map((t) => t.name));
    for (const task of data.tasks) if (task.project) expect(projectKeys).toContain(task.project);
    for (const note of data.notes) {
      if (note.project) expect(projectKeys).toContain(note.project);
      for (const tag of note.tags) expect(tagNames).toContain(tag);
    }
    for (const project of data.projects)
      for (const tag of project.tags) expect(tagNames).toContain(tag);
    for (const goal of data.goals)
      for (const key of goal.projects) expect(projectKeys).toContain(key);
  });

  it('dates : environ trois mois d’historique, rien dans le futur, échéances autour d’aujourd’hui', () => {
    expect(daysAgo(data.user.createdAt)).toBeGreaterThanOrEqual(85);
    const done = data.tasks.filter((t) => t.status === 'DONE');
    expect(done.every((t) => t.completedAt && t.completedAt <= now)).toBe(true);
    expect(done.every((t) => t.createdAt < t.completedAt!)).toBe(true);
    expect(Math.max(...done.map((t) => daysAgo(t.completedAt!)))).toBeGreaterThan(80);

    const open = data.tasks.filter((t) => t.status !== 'DONE');
    expect(open.every((t) => t.completedAt === null)).toBe(true);
    const overdue = open.filter((t) => t.dueDate && t.dueDate.getTime() < now.getTime() - DAY);
    expect(overdue).toHaveLength(2);
    expect(data.notes.every((n) => n.createdAt <= n.updatedAt && n.updatedAt <= now)).toBe(true);
  });

  it('activité : une entrée par projet et note créés, tâche terminée et jalon coché', () => {
    const activity = demoActivity(data);
    const doneMilestones = data.goals.flatMap((g) => g.milestones).filter((m) => m.doneAt);
    const doneTasks = data.tasks.filter((t) => t.completedAt);
    expect(activity).toHaveLength(
      data.projects.length + data.notes.length + doneTasks.length + doneMilestones.length,
    );
    expect(activity.every((a) => a.createdAt <= now)).toBe(true);
    // Ordre chronologique et série en cours : activité la veille et l'avant-veille.
    expect(activity.map((a) => a.createdAt.getTime())).toEqual(
      activity.map((a) => a.createdAt.getTime()).sort((a, b) => a - b),
    );
    expect(activity.some((a) => daysAgo(a.createdAt) < 2)).toBe(true);
    expect(activity.some((a) => daysAgo(a.createdAt) >= 1.5 && daysAgo(a.createdAt) < 3)).toBe(
      true,
    );
  });
});

describe('protection du compte de démo', () => {
  const context = (email?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: email ? { id: 'u1', email } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  it('reconnaît le compte de démo quelle que soit la casse', () => {
    expect(isDemoAccount('demo@devmirror.dev')).toBe(true);
    expect(isDemoAccount(' Demo@DevMirror.dev ')).toBe(true);
    expect(isDemoAccount('ada@devmirror.dev')).toBe(false);
    expect(isDemoAccount(undefined)).toBe(false);
  });

  it('le guard bloque le compte de démo (403) et laisse passer les autres', () => {
    const guard = new DemoAccountGuard();
    expect(() => guard.canActivate(context('demo@devmirror.dev'))).toThrow(ForbiddenException);
    expect(guard.canActivate(context('ada@devmirror.dev'))).toBe(true);
    expect(guard.canActivate(context())).toBe(true);
  });
});
