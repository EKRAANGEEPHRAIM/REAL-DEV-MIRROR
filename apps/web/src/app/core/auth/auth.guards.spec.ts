import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authGuard, guestGuard } from './auth.guards';
import { AuthStore } from './auth.store';
import { sessionResponse } from '../../../testing/auth-fixtures';

@Component({ template: '' })
class Blank {}

describe('guards d’authentification', () => {
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: Blank, canActivate: [guestGuard] },
          { path: 'dashboard', component: Blank, canActivate: [authGuard] },
          { path: 'projects', component: Blank, canActivate: [authGuard] },
        ]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    // Comme App au démarrage : la création du store lance la restauration de session.
    TestBed.inject(AuthStore);
  });

  it('attend la restauration puis laisse entrer un utilisateur connecté', async () => {
    const navigation = router.navigateByUrl('/projects');
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

    await navigation;
    expect(router.url).toBe('/projects');
  });

  it('redirige un visiteur vers /login en mémorisant la page demandée', async () => {
    const navigation = router.navigateByUrl('/projects');
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await navigation;
    expect(router.url).toBe('/login?returnUrl=%2Fprojects');
  });

  it('renvoie un utilisateur déjà connecté de /login vers le tableau de bord', async () => {
    const navigation = router.navigateByUrl('/login');
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());

    await navigation;
    expect(router.url).toBe('/dashboard');
  });
});
