import { DIALOG_DATA } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Task } from '@devmirror/api-client';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { of } from 'rxjs';
import { makeTask } from '../../../../testing/task-fixtures';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { TaskFormDialog } from './task-form-dialog';

describe('TaskFormDialog', () => {
  let backend: HttpTestingController;
  const close = vi.fn();
  const confirm = { confirm: vi.fn() };
  // Faux BrnDialogRef : close() observé, no-op pour les enregistrements (titre, description…).
  const dialogRef = new Proxy({ close } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
  });

  async function render(task?: Task, projectId?: string) {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TaskFormDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BrnDialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { task, projectId } },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TaskFormDialog);
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({
        data: [{ id: 'p1', name: 'DevMirror' }],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      });
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const button = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  const submit = (element: HTMLElement) =>
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

  afterEach(() => backend.verify());

  it('crée la tâche puis sa checklist dans l’ordre, et se ferme avec la tâche complète', async () => {
    const { fixture, element } = await render(undefined, 'p1');

    type(element, '#task-title', 'Préparer la démo');
    type(element, '#task-due', '2026-10-30');
    for (const item of ['Slides', 'Script']) {
      type(element, '#new-subtask', item);
      // Le bouton « Ajouter » n'est activé qu'une fois la saisie prise en compte.
      await fixture.whenStable();
      button(element, 'Ajouter').click();
      await fixture.whenStable();
    }
    submit(element);

    const create = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/tasks');
    expect(create.request.body).toMatchObject({
      title: 'Préparer la démo',
      status: 'TODO',
      priority: 'MEDIUM',
      projectId: 'p1',
      dueDate: new Date(2026, 9, 30, 23, 59, 59, 999).toISOString(),
    });
    create.flush(makeTask({ id: 'new' }));

    // Sous-tâches créées l'une après l'autre (ordre conservé)
    const first = backend.expectOne('/api/v1/tasks/new/subtasks');
    expect(first.request.body).toEqual({ title: 'Slides' });
    first.flush({ id: 's1', title: 'Slides', done: false, position: 0 });
    backend
      .expectOne('/api/v1/tasks/new/subtasks')
      .flush({ id: 's2', title: 'Script', done: false, position: 1 });

    const full = makeTask({
      id: 'new',
      subtasks: [{ id: 's1', title: 'Slides', done: false, position: 0 }],
    });
    backend.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/tasks/new').flush(full);

    expect(close).toHaveBeenCalledWith({ type: 'saved', task: full });
  });

  it('en modification, coche un élément de la checklist immédiatement', async () => {
    const task = makeTask({
      id: 't1',
      subtasks: [{ id: 's1', title: 'Slides', done: false, position: 0 }],
    });
    const { element } = await render(task);

    element
      .querySelector<HTMLInputElement>('li input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));

    const request = backend.expectOne('/api/v1/tasks/t1/subtasks/s1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ done: true });
    request.flush({ id: 's1', title: 'Slides', done: true, position: 0 });
  });

  it('bloque l’envoi sans titre', async () => {
    const { fixture, element } = await render();

    submit(element);
    await fixture.whenStable();

    backend.expectNone((r) => r.method === 'POST');
    expect(element.textContent).toContain('Le titre est obligatoire');
  });

  it('supprime la tâche après confirmation', async () => {
    confirm.confirm.mockReturnValue(of(true));
    const { element } = await render(makeTask({ id: 't1' }));

    button(element, 'Supprimer').click();
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(close).toHaveBeenCalledWith({ type: 'deleted', id: 't1' });
  });
});
