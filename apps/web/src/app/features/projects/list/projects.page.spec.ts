import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { makeProject, page } from '../../../../testing/project-fixtures';
import { ProjectsStore } from '../data/projects.store';
import { ProjectsPage } from './projects.page';

describe('ProjectsPage', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'projects', component: ProjectsPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  async function open(url: string) {
    await harness.navigateByUrl(url);
    backend.expectOne('/api/v1/tags').flush([]);
  }

  function projectsRequest() {
    return backend.expectOne((r) => r.url === '/api/v1/projects');
  }

  it('lit les filtres dans l’URL, les envoie à l’API et affiche les cartes', async () => {
    await open('/projects?status=DONE&q=api&page=2');

    const request = projectsRequest();
    expect(request.request.params.get('status')).toBe('DONE');
    expect(request.request.params.get('q')).toBe('api');
    expect(request.request.params.get('page')).toBe('2');
    request.flush(page([makeProject({ name: 'API Nest' })], 13, 2));
    harness.detectChanges();

    const text = harness.routeNativeElement!.textContent ?? '';
    expect(text).toContain('API Nest');
    expect(text).toContain('Page 2 sur 2');
  });

  it('distingue « aucun projet » de « aucun résultat pour ces filtres »', async () => {
    await open('/projects');
    projectsRequest().flush(page([], 0));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Aucun projet pour l’instant');

    await harness.navigateByUrl('/projects?q=introuvable');
    projectsRequest().flush(page([], 0));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Aucun projet ne correspond');
  });

  it('un changement de page met à jour l’URL, ce qui recharge la liste', async () => {
    await open('/projects?status=IDEA');
    projectsRequest().flush(page([makeProject()], 30, 1));
    harness.detectChanges();

    const next = Array.from(harness.routeNativeElement!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Suivante'),
    )!;
    next.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/projects?status=IDEA&page=2');
    projectsRequest().flush(page([makeProject({ id: 'p2' })], 30, 2));
  });

  it('affiche l’erreur et permet de réessayer', async () => {
    await open('/projects');
    projectsRequest().flush(
      { message: 'Base de données indisponible' },
      { status: 503, statusText: 'Unavailable' },
    );
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Base de données indisponible');

    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Réessayer'))!
      .click();
    projectsRequest().flush(page([makeProject()]));
    harness.detectChanges();
    expect(TestBed.inject(ProjectsStore).status()).toBe('loaded');
  });
});
