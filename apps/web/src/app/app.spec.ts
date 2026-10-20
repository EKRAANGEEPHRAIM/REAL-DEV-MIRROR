import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { sessionResponse } from '../testing/auth-fixtures';

describe('App', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  it('affiche le shell et la navigation quand la session est restaurée', async () => {
    const fixture = TestBed.createComponent(App);
    const navigation = TestBed.inject(Router).navigateByUrl('/');
    backend.expectOne('/api/v1/auth/refresh').flush(sessionResponse());
    await navigation;
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toContain('Tableau de bord');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('« / » sans session mène à la connexion, pas à un layout vide', async () => {
    const fixture = TestBed.createComponent(App);
    const navigation = TestBed.inject(Router).navigateByUrl('/');
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await navigation;
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('les pages publiques s’ouvrent sans session', async () => {
    const fixture = TestBed.createComponent(App);
    const navigation = TestBed.inject(Router).navigateByUrl('/register');
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await navigation;
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/register');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Créer un compte',
    );
  });

  it('affiche la page de connexion sans session', async () => {
    const fixture = TestBed.createComponent(App);
    const navigation = TestBed.inject(Router).navigateByUrl('/projects');
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await navigation;
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fprojects');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Connexion',
    );
  });
});
