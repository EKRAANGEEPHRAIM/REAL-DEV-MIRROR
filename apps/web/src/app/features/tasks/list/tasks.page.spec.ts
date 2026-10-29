import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { makeTask, taskPage } from '../../../../testing/task-fixtures';
import { TaskDialogs } from '../form/task-dialogs';
import { TasksPage } from './tasks.page';

describe('TasksPage', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;
  const dialogs = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'tasks', component: TasksPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskDialogs, useValue: dialogs },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  async function open(url: string) {
    await harness.navigateByUrl(url);
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } });
  }

  const tasksRequest = () => backend.expectOne((r) => r.url === '/api/v1/tasks');

  it('envoie les filtres de l’URL et met en avant les tâches en retard', async () => {
    await open('/tasks?due=overdue&priority=URGENT');

    const request = tasksRequest();
    expect(request.request.params.get('overdue')).toBe('true');
    expect(request.request.params.get('priority')).toBe('URGENT');
    request.flush(
      taskPage([
        makeTask({
          title: 'Facture client',
          priority: 'URGENT',
          dueDate: '2020-01-01T22:59:59.999Z',
        }),
      ]),
    );
    harness.detectChanges();

    const text = harness.routeNativeElement!.textContent ?? '';
    expect(text).toContain('Facture client');
    expect(text).toContain('Urgente');
    expect(text).toContain('En retard');
  });

  it('coche une tâche depuis la liste', async () => {
    await open('/tasks');
    tasksRequest().flush(taskPage([makeTask({ id: 't1' })]));
    harness.detectChanges();

    harness
      .routeNativeElement!.querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));

    const patch = backend.expectOne('/api/v1/tasks/t1');
    expect(patch.request.body).toEqual({ status: 'DONE' });
    patch.flush(makeTask({ id: 't1', status: 'DONE' }));
  });

  it('affiche le Kanban avec ?view=board, sans charger la liste ni filtrer par statut', async () => {
    await open('/tasks?view=board&status=DONE&priority=HIGH');

    const request = tasksRequest();
    expect(request.request.params.get('limit')).toBe('100');
    expect(request.request.params.get('sort')).toBe('position:asc');
    expect(request.request.params.get('priority')).toBe('HIGH');
    expect(request.request.params.has('status')).toBe(false);
    request.flush(
      taskPage([
        makeTask({ title: 'En revue', status: 'IN_REVIEW' }),
        makeTask({ id: 't2', title: 'À faire' }),
      ]),
    );
    harness.detectChanges();

    const element = harness.routeNativeElement!;
    const headings = Array.from(element.querySelectorAll('section h2')).map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    // Les compteurs sont annoncés aux lecteurs d'écran : « À faire, 1 tâche »
    expect(headings).toEqual([
      'À faire, 1 tâche',
      'En cours, 0 tâche',
      'En revue, 1 tâche',
      'Terminée, 0 tâche',
    ]);
    expect(element.querySelector('#task-filter-status')).toBeNull();
  });

  it('bascule vers le Kanban en retirant statut et tri de l’URL', async () => {
    await open('/tasks?status=TODO&sort=title:asc&priority=LOW');
    tasksRequest().flush(taskPage([], 0));
    harness.detectChanges();

    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Kanban'))!
      .click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/tasks?priority=LOW&view=board');
    tasksRequest().flush(taskPage([], 0));
  });

  it('recharge la liste après la création d’une tâche', async () => {
    dialogs.open.mockReturnValue(of({ type: 'saved', task: makeTask() }));
    await open('/tasks');
    tasksRequest().flush(taskPage([], 0));
    harness.detectChanges();

    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Nouvelle tâche'))!
      .click();

    tasksRequest().flush(taskPage([makeTask()]));
  });
});
