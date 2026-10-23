import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { makeTask, taskPage } from '../../../../testing/task-fixtures';
import { TasksStore } from '../../tasks/data/tasks.store';
import { TaskDialogs } from '../../tasks/form/task-dialogs';
import { ProjectTasks, type ProjectTasksView } from './project-tasks';

describe('ProjectTasks', () => {
  let backend: HttpTestingController;
  const dialogs = { open: vi.fn() };

  async function render(view: ProjectTasksView = 'list') {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProjectTasks],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskDialogs, useValue: dialogs },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProjectTasks);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('view', view);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const tasksRequest = () => backend.expectOne((r) => r.url === '/api/v1/tasks');
  const progressText = (element: HTMLElement) =>
    element.querySelector('[hlmCardDescription]')?.textContent?.replace(/\s+/g, ' ').trim();

  afterEach(() => backend.verify());

  it('charge les tâches du projet et calcule la progression', async () => {
    const { fixture, element } = await render();

    const request = tasksRequest();
    expect(request.request.params.get('projectId')).toBe('p1');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush(
      taskPage([
        makeTask({ id: 'a', status: 'DONE' }),
        makeTask({ id: 'b' }),
        makeTask({ id: 'c' }),
        makeTask({ id: 'd' }),
      ]),
    );
    await fixture.whenStable();

    expect(progressText(element)).toBe('1 terminée(s) sur 4 · 25 %');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
  });

  it('fait avancer la progression dès qu’une tâche est cochée', async () => {
    const { fixture, element } = await render();
    tasksRequest().flush(taskPage([makeTask({ id: 'a' }), makeTask({ id: 'b' })]));
    await fixture.whenStable();

    element
      .querySelector<HTMLInputElement>('li input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(progressText(element)).toBe('1 terminée(s) sur 2 · 50 %');
    backend.expectOne('/api/v1/tasks/a').flush(makeTask({ id: 'a', status: 'DONE' }));
  });

  it('en Kanban, charge le tableau du projet et masque le nom du projet sur les cartes', async () => {
    const { fixture, element } = await render('board');

    const request = tasksRequest();
    expect(request.request.params.get('projectId')).toBe('p1');
    expect(request.request.params.get('sort')).toBe('position:asc');
    request.flush(
      taskPage([
        makeTask({
          id: 'a',
          status: 'IN_PROGRESS',
          project: { id: 'p1', name: 'DevMirror', color: null },
        }),
      ]),
    );
    await fixture.whenStable();

    expect(element.querySelectorAll('dm-kanban-card')).toHaveLength(1);
    expect(element.querySelector('dm-kanban-card')?.textContent).not.toContain('DevMirror');
  });

  it('crée une tâche rattachée au projet puis recharge la liste', async () => {
    dialogs.open.mockReturnValue(of({ type: 'saved', task: makeTask() }));
    const { element } = await render();
    tasksRequest().flush(taskPage([], 0));

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Nouvelle tâche'))!
      .click();

    expect(dialogs.open).toHaveBeenCalledWith(undefined, { projectId: 'p1', status: undefined });
    tasksRequest().flush(taskPage([makeTask()]));
  });

  it('utilise sa propre instance de TasksStore, pas celle de la page /tasks', async () => {
    await render();
    tasksRequest().flush(taskPage([], 0));

    const rootStore = TestBed.inject(TasksStore);
    expect(rootStore.entities()).toEqual([]);
    expect(rootStore.status()).toBe('idle');
  });
});
