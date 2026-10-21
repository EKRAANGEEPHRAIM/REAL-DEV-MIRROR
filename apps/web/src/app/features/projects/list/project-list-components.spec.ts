import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { makeProject } from '../../../../testing/project-fixtures';
import { filtersFromUrl, type ProjectFilters } from '../project-filters';
import { ProjectCard } from './project-card';
import { ProjectFiltersBar } from './project-filters-bar';

describe('ProjectCard', () => {
  async function render(overrides = {}) {
    await TestBed.configureTestingModule({
      imports: [ProjectCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectCard);
    fixture.componentRef.setInput('project', makeProject(overrides));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('affiche le nom, le statut en français, la progression et un lien vers le détail', async () => {
    const element = await render();

    expect(element.querySelector('h2')?.textContent).toContain('DevMirror');
    expect(element.textContent).toContain('En cours');
    expect(element.textContent).toContain('1/4 tâches');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/projects/p1');
  });

  it('limite les technologies affichées à 4 et indique le reste', async () => {
    const element = await render({
      techStack: ['tech-1', 'tech-2', 'tech-3', 'tech-4', 'tech-5', 'tech-6'],
    });

    expect(element.textContent).toContain('tech-4');
    expect(element.textContent).toContain('+2');
    expect(element.textContent).not.toContain('tech-5');
  });
});

describe('ProjectFiltersBar', () => {
  async function render(value: ProjectFilters = filtersFromUrl({})) {
    await TestBed.configureTestingModule({ imports: [ProjectFiltersBar] }).compileComponents();
    const fixture = TestBed.createComponent(ProjectFiltersBar);
    fixture.componentRef.setInput('value', value);
    const changes: Partial<ProjectFilters>[] = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, changes };
  }

  afterEach(() => vi.useRealTimers());

  it('temporise la recherche : un seul changement après 300 ms de pause', async () => {
    const { element, changes } = await render();
    // Faux timers après le rendu : whenStable() attendrait sinon des timers figés.
    vi.useFakeTimers();
    const input = element.querySelector<HTMLInputElement>('#project-search')!;

    for (const value of ['a', 'ap', 'api ']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);
    }
    expect(changes).toEqual([]);

    vi.advanceTimersByTime(300);
    expect(changes).toEqual([{ q: 'api' }]);
  });

  it('émet le statut choisi, et null pour « Tous »', async () => {
    const { element, changes } = await render();
    const select = element.querySelector<HTMLSelectElement>('#project-status')!;

    select.value = 'DONE';
    select.dispatchEvent(new Event('change'));
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(changes).toEqual([{ status: 'DONE' }, { status: null }]);
  });

  it('désactive « Inclure les archivés » quand un statut est choisi', async () => {
    const { element } = await render(filtersFromUrl({ status: 'IDEA' }));

    expect(element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
  });
});
