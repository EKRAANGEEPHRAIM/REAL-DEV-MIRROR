import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeTask, taskPage } from '../../../../testing/task-fixtures';
import { groupByStatus, KanbanStore } from './kanban.store';

describe('KanbanStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Tableau : TODO = [a, b, c], IN_PROGRESS = [d] */
  function loadedBoard() {
    const store = TestBed.inject(KanbanStore);
    store.load({ page: 3, projectId: 'p1', sort: 'title:asc' });
    const request = backend.expectOne((r) => r.url === '/api/v1/tasks');
    expect(request.request.params.toString()).toBe(
      'page=1&projectId=p1&sort=position:asc&limit=100',
    );
    request.flush(
      taskPage([
        makeTask({ id: 'c', position: 2 }),
        makeTask({ id: 'a', position: 0 }),
        makeTask({ id: 'b', position: 1 }),
        makeTask({ id: 'd', status: 'IN_PROGRESS', position: 0 }),
      ]),
    );
    return store;
  }

  const ids = (store: InstanceType<typeof KanbanStore>, status: 'TODO' | 'IN_PROGRESS' | 'DONE') =>
    store.columns()[status].map((t) => t.id);

  it('répartit les tâches par colonne, dans l’ordre des positions', () => {
    const store = loadedBoard();

    expect(ids(store, 'TODO')).toEqual(['a', 'b', 'c']);
    expect(ids(store, 'IN_PROGRESS')).toEqual(['d']);
    expect(store.total()).toBe(4);
  });

  it('réordonne une colonne immédiatement puis l’enregistre', () => {
    const store = loadedBoard();

    store.move('TODO', 'TODO', 2, 0);

    expect(ids(store, 'TODO')).toEqual(['c', 'a', 'b']);
    const request = backend.expectOne('/api/v1/tasks/reorder');
    expect(request.request.body).toEqual({ status: 'TODO', taskIds: ['c', 'a', 'b'] });
    request.flush([
      makeTask({ id: 'c', position: 0 }),
      makeTask({ id: 'a', position: 1 }),
      makeTask({ id: 'b', position: 2 }),
    ]);
  });

  it('déplace une carte vers une autre colonne en changeant son statut', () => {
    const store = loadedBoard();

    store.move('TODO', 'DONE', 0, 0);

    expect(ids(store, 'TODO')).toEqual(['b', 'c']);
    expect(ids(store, 'DONE')).toEqual(['a']);
    expect(store.columns().DONE[0]).toMatchObject({
      status: 'DONE',
      completedAt: expect.any(String),
    });
    backend
      .expectOne('/api/v1/tasks/reorder')
      .flush([makeTask({ id: 'a', status: 'DONE', completedAt: '2026-10-23T10:00:00.000Z' })]);
    expect(store.columns().DONE[0].completedAt).toBe('2026-10-23T10:00:00.000Z');
  });

  it('remet tout le tableau en place si l’API refuse', () => {
    const store = loadedBoard();

    store.move('TODO', 'IN_PROGRESS', 1, 0);
    expect(ids(store, 'IN_PROGRESS')).toEqual(['b', 'd']);

    backend
      .expectOne('/api/v1/tasks/reorder')
      .flush(
        { message: 'Une ou plusieurs tâches sont introuvables' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(ids(store, 'TODO')).toEqual(['a', 'b', 'c']);
    expect(ids(store, 'IN_PROGRESS')).toEqual(['d']);
  });

  it('envoie les déplacements successifs dans l’ordre, un à la fois', () => {
    const store = loadedBoard();

    store.move('TODO', 'TODO', 2, 0);
    store.move('TODO', 'DONE', 0, 0);

    // Le second déplacement attend la réponse du premier
    const first = backend.expectOne('/api/v1/tasks/reorder');
    expect(first.request.body.status).toBe('TODO');
    first.flush([]);
    const second = backend.expectOne('/api/v1/tasks/reorder');
    expect(second.request.body).toEqual({ status: 'DONE', taskIds: ['c'] });
    second.flush([makeTask({ id: 'c', status: 'DONE' })]);
  });

  it('moveTo (menu clavier) envoie la carte en bas de la colonne choisie', () => {
    const store = loadedBoard();

    store.moveTo(store.columns().TODO[0], 'IN_PROGRESS');

    expect(ids(store, 'IN_PROGRESS')).toEqual(['d', 'a']);
    backend.expectOne('/api/v1/tasks/reorder').flush([]);
  });

  it('ignore une requête nulle (vue liste active)', () => {
    TestBed.inject(KanbanStore).load(null);
    backend.expectNone((r) => r.url === '/api/v1/tasks');
  });
});

describe('groupByStatus', () => {
  it('crée les quatre colonnes même vides', () => {
    expect(Object.keys(groupByStatus([]))).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  });
});
