import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { sessionResponse } from '../../../testing/auth-fixtures';
import { AuthStore, initialsOf, safeReturnUrl, SESSION_HINT_KEY } from './auth.store';

describe('AuthStore', () => {
  let http: HttpTestingController;
  let router: Router;

  function createStore() {
    const store = TestBed.inject(AuthStore);
    return store;
  }

  beforeEach(() => {
    // Session déjà ouverte dans ce navigateur : la restauration interroge l'API.

    localStorage.setItem(SESSION_HINT_KEY, '1');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();

    localStorage.clear();
  });

  describe('restauration au démarrage', () => {
    it('restaure la session depuis le cookie', () => {
      const store = createStore();
      expect(store.status()).toBe('restoring');

      http.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

      expect(store.status()).toBe('authenticated');
      expect(store.user()?.name).toBe('Ada Lovelace');
      expect(store.accessToken()).toBe('jwt-1');
      expect(store.initials()).toBe('AL');
    });

    it('passe en anonyme sans cookie valide', () => {
      const store = createStore();

      http
        .expectOne('/api/v1/auth/refresh')
        .flush({ message: 'Session expirée' }, { status: 401, statusText: 'Unauthorized' });

      expect(store.status()).toBe('anonymous');
      expect(store.accessToken()).toBeNull();
      // Session refusée : plus d'indice, la prochaine ouverture ne tentera pas de refresh.
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    });

    it('sans session dans ce navigateur : anonyme aussitôt, API réveillée, aucun refresh', () => {
      localStorage.removeItem(SESSION_HINT_KEY);
      const store = createStore();

      expect(store.status()).toBe('anonymous');
      http.expectNone('/api/v1/auth/refresh');
      http.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/health').flush({});
    });

    it('le réveil de l’API peut échouer sans conséquence', () => {
      localStorage.removeItem(SESSION_HINT_KEY);
      const store = createStore();

      http.expectOne('/api/v1/health').error(new ProgressEvent('error'));
      expect(store.status()).toBe('anonymous');
    });
  });

  it('connexion puis déconnexion : l’indice de session suit la session', () => {
    localStorage.removeItem(SESSION_HINT_KEY);
    const store = createStore();
    http.expectOne('/api/v1/health').flush({});

    store.login({ credentials: { email: 'ada@devmirror.dev', password: 'MotDePasse2026' } });
    http.expectOne('/api/v1/auth/login').flush(sessionResponse());
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');

    store.logout();
    http.expectOne('/api/v1/auth/logout').flush(null);
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(store.status()).toBe('anonymous');
  });

  describe('connexion', () => {
    function anonymousStore() {
      const store = createStore();
      http
        .expectOne('/api/v1/auth/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      return store;
    }

    it('ouvre la session et redirige vers la page demandée', () => {
      const store = anonymousStore();

      store.login({
        credentials: { email: 'ada@devmirror.dev', password: 'MotDePasse2026' },
        returnUrl: '/projects',
      });
      expect(store.pending()).toBe(true);
      const request = http.expectOne('/api/v1/auth/login');
      expect(request.request.body).toEqual({
        email: 'ada@devmirror.dev',
        password: 'MotDePasse2026',
      });
      request.flush(sessionResponse());

      expect(store.isAuthenticated()).toBe(true);
      expect(store.pending()).toBe(false);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/projects');
    });

    it('affiche le message de l’API en cas d’échec', () => {
      const store = anonymousStore();

      store.login({ credentials: { email: 'ada@devmirror.dev', password: 'faux' } });
      http
        .expectOne('/api/v1/auth/login')
        .flush(
          { statusCode: 401, message: 'Email ou mot de passe incorrect' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(store.error()).toBe('Email ou mot de passe incorrect');
      expect(store.pending()).toBe(false);
      expect(store.isAuthenticated()).toBe(false);
    });
  });

  it('refreshAccessToken ne lance qu’un seul refresh pour plusieurs demandes simultanées', () => {
    const store = createStore();
    http.expectOne('/api/v1/auth/refresh').flush(sessionResponse('jwt-1'));

    const tokens: string[] = [];
    store.refreshAccessToken().subscribe((t) => tokens.push(t));
    store.refreshAccessToken().subscribe((t) => tokens.push(t));
    http.expectOne('/api/v1/auth/refresh').flush(sessionResponse('jwt-2'));

    expect(tokens).toEqual(['jwt-2', 'jwt-2']);
  });

  it('logout ferme la session même si l’API échoue, puis renvoie vers /login', () => {
    const store = createStore();
    http.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

    store.logout();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.status()).toBe('anonymous');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});

describe('safeReturnUrl', () => {
  it.each([
    ['/projects?tab=1', '/projects?tab=1'],
    [undefined, '/dashboard'],
    ['https://site-malveillant.example', '/dashboard'],
    ['//site-malveillant.example', '/dashboard'],
  ])('%s -> %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});

describe('initialsOf', () => {
  it('prend les initiales des deux premiers mots', () => {
    expect(initialsOf('ada king lovelace')).toBe('AK');
    expect(initialsOf('  ')).toBe('');
  });
});
