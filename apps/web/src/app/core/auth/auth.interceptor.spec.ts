import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';
import { sessionResponse } from '../../../testing/auth-fixtures';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Session restaurée avec un premier jeton
    TestBed.inject(AuthStore);
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse('jwt-1'));
  });

  afterEach(() => backend.verify());

  it('ajoute le jeton d’accès aux appels de l’API', () => {
    http.get('/api/v1/users/me').subscribe();

    const request = backend.expectOne('/api/v1/users/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    request.flush({});
  });

  it('n’envoie pas le jeton aux routes de session ni aux autres domaines', () => {
    http.post('/api/v1/auth/login', {}).subscribe();
    http.get('https://cdn.example.com/data.json').subscribe();

    expect(backend.expectOne('/api/v1/auth/login').request.headers.has('Authorization')).toBe(
      false,
    );
    expect(
      backend.expectOne('https://cdn.example.com/data.json').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('sur un 401, renouvelle la session puis rejoue la requête avec le nouveau jeton', () => {
    let body: unknown;
    http.get('/api/v1/users/me').subscribe((response) => (body = response));

    backend.expectOne('/api/v1/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse('jwt-2'));
    const retry = backend.expectOne('/api/v1/users/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer jwt-2');
    retry.flush({ name: 'Ada' });

    expect(body).toEqual({ name: 'Ada' });
  });

  it('ne lance qu’un refresh pour plusieurs 401 simultanés', () => {
    http.get('/api/v1/projects').subscribe();
    http.get('/api/v1/tasks').subscribe();

    backend.expectOne('/api/v1/projects').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/tasks').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse('jwt-2'));

    backend.expectOne('/api/v1/projects').flush([]);
    backend.expectOne('/api/v1/tasks').flush([]);
  });

  it('si le refresh échoue, renvoie vers la connexion et propage l’erreur', () => {
    let status = 0;
    http
      .get('/api/v1/users/me')
      .subscribe({ error: (error: { status: number }) => (status = error.status) });

    backend.expectOne('/api/v1/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
    expect(TestBed.inject(AuthStore).status()).toBe('anonymous');
  });

  it('laisse passer les autres erreurs sans refresh', () => {
    let status = 0;
    http
      .get('/api/v1/projects')
      .subscribe({ error: (error: { status: number }) => (status = error.status) });

    backend.expectOne('/api/v1/projects').flush(null, { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });
});
