import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { makeProject } from '../../../../testing/project-fixtures';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { ProjectDialogs } from '../form/project-dialogs';
import { ProjectDetailPage } from './project-detail.page';

@Component({ template: '' })
class Blank {}

describe('ProjectDetailPage', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;
  const confirm = { confirm: vi.fn() };
  const dialogs = { open: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'projects/:id', component: ProjectDetailPage },
            { path: 'projects', component: Blank },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmService, useValue: confirm },
        { provide: ProjectDialogs, useValue: dialogs },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  async function open(
    project = makeProject({ id: 'p1', repoUrl: 'https://github.com/ada/devmirror' }),
  ) {
    await harness.navigateByUrl('/projects/p1');
    backend.expectOne('/api/v1/projects/p1').flush(project);
    harness.detectChanges();
    // Section des tâches du projet, chargée une fois le projet affiché
    backend
      .expectOne((r) => r.url === '/api/v1/tasks')
      .flush({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } });
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  const button = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  it('affiche le projet, sa progression et ses liens externes sécurisés', async () => {
    const element = await open();

    expect(element.querySelector('h1')?.textContent).toContain('DevMirror');
    // La progression vient des tâches chargées (aucune ici) — testée dans project-tasks.spec
    expect(element.textContent).toContain('Aucune tâche pour l’instant.');
    const repo = element.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/ada/devmirror"]',
    )!;
    expect(repo.target).toBe('_blank');
    expect(repo.rel).toBe('noopener noreferrer');
  });

  it('affiche « Projet introuvable » sur un 404', async () => {
    await harness.navigateByUrl('/projects/p1');
    backend
      .expectOne('/api/v1/projects/p1')
      .flush({ message: 'Projet introuvable' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();

    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toContain(
      'Projet introuvable',
    );
  });

  it('met à jour la page avec le projet renvoyé par le formulaire', async () => {
    dialogs.open.mockReturnValue(of(makeProject({ id: 'p1', name: 'DevMirror v2' })));
    const element = await open();

    button(element, 'Modifier').click();
    harness.detectChanges();

    expect(element.querySelector('h1')?.textContent).toContain('DevMirror v2');
  });

  it('supprime après confirmation puis revient à la liste', async () => {
    confirm.confirm.mockReturnValue(of(true));
    const element = await open();

    button(element, 'Supprimer').click();
    expect(confirm.confirm.mock.calls[0][0]).toMatchObject({ destructive: true });
    backend
      .expectOne((r) => r.method === 'DELETE' && r.url === '/api/v1/projects/p1')
      .flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/projects');
  });

  it('ne supprime rien si l’utilisateur annule', async () => {
    confirm.confirm.mockReturnValue(of(false));
    const element = await open();

    button(element, 'Supprimer').click();

    backend.expectNone((r) => r.method === 'DELETE');
  });
});
