import type { SearchResults } from '@devmirror/api-client';
import { buildPalette, normalize, resultItems, staticItems } from './palette-items';

const results: SearchResults = {
  q: 'jwt',
  projects: [{ id: 'p1', name: 'Auth JWT', color: '#6366f1', status: 'IN_PROGRESS' }],
  tasks: [
    {
      id: 't1',
      title: 'Rotation JWT',
      status: 'DONE',
      priority: 'HIGH',
      project: { id: 'p1', name: 'Auth JWT', color: null },
    },
  ],
  notes: [{ id: 'n1', title: 'Pièges JWT', excerpt: 'Un jeton sert une fois.', pinned: true }],
};

describe('palette de commandes', () => {
  it('ignore casse et accents', () => {
    expect(normalize('  TÂCHES ')).toBe('taches');
  });

  it('montre toutes les actions et pages sans saisie, filtre ensuite', () => {
    const all = staticItems('');
    expect(all.map((item) => item.group)).toContain('Actions');
    expect(all.some((item) => item.label === 'Aller à : Paramètres')).toBe(true);

    expect(staticItems('tache').map((item) => item.label)).toEqual(['Aller à : Tâches']);
    expect(staticItems('dark').map((item) => item.id)).toEqual(['cmd-theme']);
  });

  it('transforme les résultats en liens vers la bonne page', () => {
    const [project, task, note] = resultItems(results);
    expect(project).toMatchObject({
      group: 'Projets',
      color: '#6366f1',
      target: { kind: 'link', commands: ['/projects', 'p1'] },
    });
    expect(task).toMatchObject({
      group: 'Tâches',
      hint: 'Terminée · Auth JWT',
      icon: 'lucideSquareCheckBig',
      target: { kind: 'link', commands: ['/tasks'], queryParams: { q: 'Rotation JWT' } },
    });
    expect(note).toMatchObject({ icon: 'lucidePin', target: { commands: ['/notes', 'n1'] } });
  });

  it('place les résultats avant les actions, avec des index continus', () => {
    const { items, sections } = buildPalette('jwt', results);
    expect(sections.map((section) => section.group)).toEqual(['Projets', 'Tâches', 'Notes']);
    expect(items).toHaveLength(3);
    expect(sections.flatMap((section) => section.items.map((entry) => entry.index))).toEqual([
      0, 1, 2,
    ]);
  });
});
