import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivityCalendar, StatusCount, WeekCount } from '@devmirror/api-client';
import { lastTwoWeeks } from '../../../../testing/stats-fixtures';
import { ActivityHeatmap } from './activity-heatmap';
import { ProjectStatusChart } from './project-status-chart';
import { WeeklyTasksChart } from './weekly-tasks-chart';

async function render<T>(component: Type<T>, name: string, value: unknown) {
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('graphique des tâches par semaine', () => {
  const weeks: WeekCount[] = lastTwoWeeks(3, 5);

  it('dessine une colonne par semaine non vide et étiquette seulement la semaine courante', async () => {
    const { element } = await render(WeeklyTasksChart, 'weeks', weeks);

    expect(element.querySelectorAll('path')).toHaveLength(2);
    // 12 zones de survol / focus, une par semaine, vides comprises
    const targets = element.querySelectorAll('rect[tabindex="0"]');
    expect(targets).toHaveLength(12);
    expect(targets[11].getAttribute('aria-label')).toBe(
      `Semaine du ${new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' }).format(new Date(2026, 9, 26))} : 5 tâches terminées`,
    );
    const texts = Array.from(element.querySelectorAll('text')).map((t) => t.textContent?.trim());
    expect(texts).toContain('Cette sem.');
    // Le chiffre 5 n'apparaît qu'au-dessus de la semaine courante (axe : 0, 2, 4, 6)
    expect(texts.filter((t) => t === '5')).toHaveLength(1);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toContain('8 au total');
  });

  it('montre une infobulle au focus, sur une semaine vide aussi', async () => {
    const { fixture, element } = await render(WeeklyTasksChart, 'weeks', weeks);

    element.querySelectorAll('rect[tabindex="0"]')[0].dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(element.textContent).toContain('0 tâche terminée');

    element.querySelectorAll('rect[tabindex="0"]')[0].dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(element.textContent).not.toContain('0 tâche terminée');
  });
});

describe('graphique des projets par statut', () => {
  const statuses: StatusCount[] = [
    { status: 'IDEA', count: 1 },
    { status: 'IN_PROGRESS', count: 3 },
    { status: 'PAUSED', count: 0 },
    { status: 'DONE', count: 0 },
    { status: 'ARCHIVED', count: 0 },
  ];

  it('une barre par statut non vide, valeur au bout, libellés français', async () => {
    const { element } = await render(ProjectStatusChart, 'statuses', statuses);

    const rows = element.querySelectorAll('li');
    expect(rows).toHaveLength(5);
    expect(rows[1].getAttribute('aria-label')).toBe('En cours : 3 projets (75 %)');
    expect(rows[2].getAttribute('aria-label')).toContain('0 projet');
    // Plus longue barre : 85 % de la piste, pour laisser la place au nombre
    const bar = rows[1].querySelector<HTMLElement>('span[style*="width"]');
    expect(bar?.style.width).toBe('85%');
    expect(rows[2].querySelector('span[style*="width"]')).toBeNull();
  });

  it('affiche la part du total au survol', async () => {
    const { fixture, element } = await render(ProjectStatusChart, 'statuses', statuses);
    element.querySelectorAll('li')[0].dispatchEvent(new Event('mouseenter'));
    await fixture.whenStable();
    expect(element.textContent).toContain('25 % des projets');
  });
});

describe('heatmap d’activité', () => {
  const calendar: ActivityCalendar = {
    from: '2025-10-27',
    to: '2026-10-28',
    total: 6,
    days: [
      { date: '2026-10-27', count: 2 },
      { date: '2026-10-28', count: 4 },
    ],
  };

  it('dessine une case par jour avec 5 niveaux et une légende', async () => {
    const { element } = await render(ActivityHeatmap, 'calendar', calendar);

    const cells = element.querySelectorAll('svg rect');
    // 52 semaines complètes + lundi, mardi, mercredi de la semaine courante
    expect(cells).toHaveLength(52 * 7 + 3);
    expect(cells[cells.length - 1].getAttribute('fill')).toBe('var(--viz-heat-4)');
    expect(cells[cells.length - 2].getAttribute('fill')).toBe('var(--viz-heat-2)');
    expect(cells[0].getAttribute('fill')).toBe('var(--viz-heat-0)');
    expect(element.textContent).toContain('Moins');
    expect(element.querySelector('[tabindex="0"]')?.getAttribute('aria-label')).toBe(
      'Activité sur un an : 6 actions sur 2 jours actifs',
    );
  });

  it('au clavier : aujourd’hui au focus, puis les flèches parcourent les jours', async () => {
    const { fixture, element } = await render(ActivityHeatmap, 'calendar', calendar);
    const grid = element.querySelector<HTMLElement>('[tabindex="0"]')!;
    const live = () => element.querySelector('[aria-live]')?.textContent?.trim();

    grid.dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(live()).toBe('4 actions — mercredi 28 octobre 2026');

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    await fixture.whenStable();
    expect(live()).toBe('2 actions — mardi 27 octobre 2026');

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(live()).toBe('Aucune action — mardi 20 octobre 2026');

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    await fixture.whenStable();
    expect(live()).toContain('lundi 27 octobre 2025');
    // Pas de débordement avant le premier jour
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(live()).toContain('lundi 27 octobre 2025');
  });
});
