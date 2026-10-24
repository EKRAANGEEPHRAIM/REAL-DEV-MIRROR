import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { goalPage, makeGoal, makeMilestone } from '../../../../testing/goal-fixtures';
import { GoalsStore } from './goals.store';

describe('GoalsStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function loadedStore() {
    const store = TestBed.inject(GoalsStore);
    store.load({ page: 1, state: 'active' });
    const request = backend.expectOne((r) => r.url === '/api/v1/goals');
    expect(request.request.params.get('state')).toBe('active');
    request.flush(
      goalPage([
        makeGoal({
          id: 'g1',
          milestones: [makeMilestone({ id: 'm1', done: true }), makeMilestone({ id: 'm2' })],
        }),
      ]),
    );
    return store;
  }

  it('coche un jalon tout de suite et recalcule la progression', () => {
    const store = loadedStore();

    store.toggleMilestone({ goalId: 'g1', milestoneId: 'm2' });
    expect(store.entityMap()['g1']).toMatchObject({
      completed: true,
      progress: { done: 2, percent: 100 },
    });

    const request = backend.expectOne('/api/v1/goals/g1/milestones/m2');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ done: true });
    request.flush(makeMilestone({ id: 'm2', done: true }));
    expect(store.entityMap()['g1'].completed).toBe(true);
  });

  it('annule seulement le jalon refusé par l’API', () => {
    const store = loadedStore();

    store.toggleMilestone({ goalId: 'g1', milestoneId: 'm1' });
    store.toggleMilestone({ goalId: 'g1', milestoneId: 'm2' });
    expect(store.entityMap()['g1'].milestones.map((m) => m.done)).toEqual([false, true]);

    backend
      .expectOne('/api/v1/goals/g1/milestones/m1')
      .flush({ message: 'Erreur' }, { status: 500, statusText: 'Server Error' });
    backend.expectOne('/api/v1/goals/g1/milestones/m2').flush(makeMilestone({ done: true }));

    // m1 revient à « fait », m2 reste coché
    expect(store.entityMap()['g1'].milestones.map((m) => m.done)).toEqual([true, true]);
    expect(store.entityMap()['g1'].progress.percent).toBe(100);
  });

  it('ignore un jalon inconnu', () => {
    const store = loadedStore();
    store.toggleMilestone({ goalId: 'g1', milestoneId: 'inconnu' });
    backend.expectNone((r) => r.url.includes('/milestones/'));
  });

  it('upsert, removeLocal et reload', () => {
    const store = loadedStore();

    store.upsert(makeGoal({ id: 'g1', title: 'Nouveau titre' }));
    expect(store.entityMap()['g1'].title).toBe('Nouveau titre');

    store.removeLocal('g1');
    expect(store.ids()).toEqual([]);

    store.reload();
    expect(backend.expectOne((r) => r.url === '/api/v1/goals').request.params.get('state')).toBe(
      'active',
    );
  });
});
