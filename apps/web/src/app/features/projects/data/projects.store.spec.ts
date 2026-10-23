import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeProject, page } from '../../../../testing/project-fixtures';
import { ProjectsStore } from './projects.store';

describe('ProjectsStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('charge une page de projets avec les paramètres de la requête', () => {
    const store = TestBed.inject(ProjectsStore);

    store.load({ page: 2, limit: 12, sort: 'name:asc', q: 'api' });
    expect(store.isInitialLoading()).toBe(true);
    const request = backend.expectOne((r) => r.url === '/api/v1/projects');
    expect(request.request.params.toString()).toBe('page=2&limit=12&sort=name:asc&q=api');
    request.flush(page([makeProject({ id: 'a' }), makeProject({ id: 'b' })], 14, 2));

    expect(store.status()).toBe('loaded');
    expect(store.entities().map((p) => p.id)).toEqual(['a', 'b']);
    expect(store.total()).toBe(14);
  });

  it('garde les projets affichés pendant un rafraîchissement', () => {
    const store = TestBed.inject(ProjectsStore);
    store.load({ page: 1 });
    backend.expectOne((r) => r.url === '/api/v1/projects').flush(page([makeProject()]));

    store.load({ page: 2 });

    expect(store.isRefreshing()).toBe(true);
    expect(store.isInitialLoading()).toBe(false);
    expect(store.entities()).toHaveLength(1);
    backend.expectOne((r) => r.url === '/api/v1/projects').flush(page([], 0));
    expect(store.isEmpty()).toBe(true);
  });

  it('annule la requête précédente quand les filtres changent (switchMap)', () => {
    const store = TestBed.inject(ProjectsStore);

    store.load({ page: 1, q: 'a' });
    store.load({ page: 1, q: 'ab' });

    const [first, second] = backend.match((r) => r.url === '/api/v1/projects');
    expect(first.cancelled).toBe(true);
    second.flush(page([makeProject({ name: 'ab' })]));
    expect(store.entities()[0].name).toBe('ab');
  });

  it('expose le message d’erreur de l’API', () => {
    const store = TestBed.inject(ProjectsStore);

    store.load({ page: 1 });
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({ message: 'Tri invalide' }, { status: 400, statusText: 'Bad Request' });

    expect(store.status()).toBe('error');
    expect(store.error()).toBe('Tri invalide');
  });

  it('reload relance la dernière page demandée (après une création)', () => {
    const store = TestBed.inject(ProjectsStore);
    store.load({ page: 2, q: 'api' });
    backend.expectOne((r) => r.url === '/api/v1/projects').flush(page([makeProject()], 13, 2));

    store.reload();

    const request = backend.expectOne((r) => r.url === '/api/v1/projects');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('q')).toBe('api');
    request.flush(page([makeProject(), makeProject({ id: 'p2' })], 14, 2));
    expect(store.total()).toBe(14);
  });

  it('reload ne fait rien avant le premier chargement', () => {
    TestBed.inject(ProjectsStore).reload();
    backend.expectNone((r) => r.url === '/api/v1/projects');
  });
});
