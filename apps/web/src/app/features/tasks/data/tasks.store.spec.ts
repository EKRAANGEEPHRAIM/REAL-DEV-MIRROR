import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeTask, taskPage } from '../../../../testing/task-fixtures';
import { TasksStore } from './tasks.store';

describe('TasksStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function loadedStore() {
    const store = TestBed.inject(TasksStore);
    store.load({ page: 1, overdue: true });
    const request = backend.expectOne((r) => r.url === '/api/v1/tasks');
    expect(request.request.params.get('overdue')).toBe('true');
    request.flush(taskPage([makeTask({ id: 't1' }), makeTask({ id: 't2', status: 'DONE' })]));
    return store;
  }

  it('coche une tâche tout de suite, puis garde la version de l’API', () => {
    const store = loadedStore();

    store.toggleDone(store.entityMap()['t1']);
    expect(store.entityMap()['t1'].status).toBe('DONE');

    const request = backend.expectOne('/api/v1/tasks/t1');
    expect(request.request.body).toEqual({ status: 'DONE' });
    request.flush(makeTask({ id: 't1', status: 'DONE', completedAt: '2026-10-22T10:00:00.000Z' }));
    expect(store.entityMap()['t1'].completedAt).toBe('2026-10-22T10:00:00.000Z');
  });

  it('décoche une tâche terminée et revient en arrière si l’API refuse', () => {
    const store = loadedStore();

    store.toggleDone(store.entityMap()['t2']);
    expect(store.entityMap()['t2'].status).toBe('TODO');

    const request = backend.expectOne('/api/v1/tasks/t2');
    expect(request.request.body).toEqual({ status: 'TODO' });
    request.flush({ message: 'Erreur' }, { status: 500, statusText: 'Server Error' });

    expect(store.entityMap()['t2'].status).toBe('DONE');
  });

  it('reload relance la dernière requête', () => {
    const store = loadedStore();

    store.reload();

    expect(backend.expectOne((r) => r.url === '/api/v1/tasks').request.params.get('overdue')).toBe(
      'true',
    );
  });

  it('upsert remplace une tâche par la version enregistrée, sans recharger', () => {
    const store = loadedStore();

    store.upsert(makeTask({ id: 't1', title: 'Titre modifié', priority: 'URGENT' }));

    expect(store.entityMap()['t1']).toMatchObject({ title: 'Titre modifié', priority: 'URGENT' });
    expect(store.ids()).toEqual(['t1', 't2']);
  });

  it('removeLocal retire une tâche supprimée de la liste', () => {
    const store = loadedStore();

    store.removeLocal('t1');

    expect(store.ids()).toEqual(['t2']);
  });

  it('expose le message d’erreur et ignore une requête nulle (vue Kanban)', () => {
    const store = TestBed.inject(TasksStore);

    store.load(null);
    backend.expectNone((r) => r.url === '/api/v1/tasks');

    store.load({ page: 1 });
    backend
      .expectOne((r) => r.url === '/api/v1/tasks')
      .flush({ message: 'Échéance invalide' }, { status: 400, statusText: 'Bad Request' });
    expect(store.status()).toBe('error');
    expect(store.error()).toBe('Échéance invalide');
  });
});
