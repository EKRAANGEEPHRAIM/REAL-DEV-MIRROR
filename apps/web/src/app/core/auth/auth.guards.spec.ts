import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authGuard, guestGuard } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { AuthStore, SESSION_HINT_KEY } from './auth.store';
import { sessionResponse } from '../../../testing/auth-fixtures';

@Component({ template: '' })
class Blank {}

describe('guards d’authentification', () => {
  let backend: HttpTestingController;
  let router: Router;
  const loadSettings = vi.fn(() => Promise.resolve(Blank));

  /** withHint : une session a déjà été ouverte dans ce navigateur. */
  function setup(withHint: boolean) {
    localStorage.clear();
    loadSettings.mockClear();
    if (withHint) localStorage.setItem(SESSION_HINT_KEY, '1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: Blank, canActivate: [guestGuard] },
          { path: 'dashboard', component: Blank, canActivate: [authGuard] },
          { path: 'projects', component: Blank, canActivate: [authGuard] },
          { path: 'settings', loadComponent: loadSettings, canActivate: [authGuard] },
        ]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    // Comme App au démarrage : la création du store lance la restauration de session.
    TestBed.inject(AuthStore);
  }

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  describe('session déjà ouverte dans ce navigateur', () => {
    beforeEach(() => setup(true));

    it('attend la restauration puis laisse entrer un utilisateur connecté', async () => {
      const navigation = router.navigateByUrl('/projects');
      backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

      await navigation;
      expect(router.url).toBe('/projects');
    });

    it('télécharge le code de la page pendant le refresh, sans l’afficher avant', async () => {
      const navigation = router.navigateByUrl('/settings');
      await vi.waitFor(() => expect(loadSettings).toHaveBeenCalled());
      expect(router.url).not.toBe('/settings');

      backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());
      await navigation;
      expect(router.url).toBe('/settings');
    });

    it('session expirée : renvoie vers /login en mémorisant la page demandée', async () => {
      const navigation = router.navigateByUrl('/projects');
      backend
        .expectOne('/api/v1/auth/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      await navigation;
      expect(router.url).toBe('/login?returnUrl=%2Fprojects');
    });

    it('renvoie un utilisateur connecté de /login vers le tableau de bord', async () => {
      const navigation = router.navigateByUrl('/login');
      backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

      await navigation;
      expect(router.url).toBe('/dashboard');
    });
  });

  describe('visiteur sans session', () => {
    beforeEach(() => setup(false));

    it('voit la connexion tout de suite, sans refresh (l’API est seulement réveillée)', async () => {
      await router.navigateByUrl('/login');

      expect(router.url).toBe('/login');
      backend.expectNone('/api/v1/auth/refresh');
      backend.expectOne('/api/v1/health').flush({});
    });

    it('est renvoyé vers /login en mémorisant la page demandée', async () => {
      await router.navigateByUrl('/projects');

      expect(router.url).toBe('/login?returnUrl=%2Fprojects');
      backend.expectOne('/api/v1/health').flush({});
    });
  });
});
