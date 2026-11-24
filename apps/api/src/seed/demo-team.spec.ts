import { DEMO_EMAIL } from '../common/demo/demo-account.js';
import { buildDemoData } from './demo-data.js';
import { buildDemoTeam, DEMO_TEAM_DOMAIN } from './demo-team.js';

const now = new Date('2026-11-24T10:00:00Z');

describe('équipe du compte de démo', () => {
  const data = buildDemoData(now);
  const team = buildDemoTeam(now);
  const projectKeys = new Set(data.projects.map((project) => project.key));
  const teammateKeys = new Set(team.teammates.map((teammate) => teammate.key));

  it('est déterministe', () => {
    expect(JSON.stringify(buildDemoTeam(now))).toBe(JSON.stringify(team));
  });

  it('adresses fictives, distinctes du compte de démo', () => {
    for (const teammate of team.teammates) {
      expect(teammate.email.endsWith(`@${DEMO_TEAM_DOMAIN}`)).toBe(true);
      expect(teammate.email).not.toBe(DEMO_EMAIL);
    }
    expect(team.pendingInvitation.email.endsWith(`@${DEMO_TEAM_DOMAIN}`)).toBe(true);
    // L'invité en attente n'a pas de compte : l'invitation reste en attente
    expect(team.teammates.map((t) => t.email)).not.toContain(team.pendingInvitation.email);
  });

  it('références cohérentes avec les projets de la démo et les coéquipiers', () => {
    for (const membership of team.memberships) {
      expect(projectKeys).toContain(membership.project);
      expect(teammateKeys).toContain(membership.teammate);
    }
    for (const task of team.contributions) {
      expect(projectKeys).toContain(task.project);
      expect(teammateKeys).toContain(task.author);
    }
    expect(teammateKeys).toContain(team.sharedProject.owner);
    for (const task of team.sharedProject.tasks) {
      expect([...teammateKeys, 'demo']).toContain(task.author);
    }
    expect(projectKeys).toContain(team.pendingInvitation.project);
  });

  it('un coéquipier n’est membre qu’une fois par projet', () => {
    const pairs = team.memberships.map((m) => `${m.project}/${m.teammate}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('titres de tâches uniques, y compris face aux tâches de Camille', () => {
    const titles = [
      ...data.tasks.map((task) => task.title),
      ...team.contributions.map((task) => task.title),
      ...team.sharedProject.tasks.map((task) => task.title),
    ];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('une tâche terminée a une date de fin, les autres non', () => {
    for (const task of [...team.contributions, ...team.sharedProject.tasks]) {
      expect(task.completedAt !== null).toBe(task.status === 'DONE');
    }
  });
});
