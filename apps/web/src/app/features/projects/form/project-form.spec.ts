import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Project } from '@devmirror/api-client';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { makeProject } from '../../../../testing/project-fixtures';
import { ProjectFormDialog } from './project-form-dialog';
import { parseTechStack, toFormValue, toRequest } from './project-form.model';

describe('modèle du formulaire de projet', () => {
  it('découpe les technologies et retire vides et doublons', () => {
    expect(parseTechStack(' Angular, NestJS ,, angular ,Prisma')).toEqual([
      'Angular',
      'NestJS',
      'Prisma',
    ]);
  });

  it('pré-remplit depuis un projet et renvoie null pour les champs vidés', () => {
    const value = toFormValue(
      makeProject({
        repoUrl: 'https://github.com/x',
        tags: [{ id: 't1', name: 'a', color: null }],
      }),
    );
    expect(value).toMatchObject({ techStack: 'Angular, NestJS', tagIds: ['t1'] });

    expect(
      toRequest({ ...value, name: '  Nouveau ', description: ' ', repoUrl: '' }),
    ).toMatchObject({
      name: 'Nouveau',
      description: null,
      repoUrl: null,
      techStack: ['Angular', 'NestJS'],
      tagIds: ['t1'],
    });
  });
});

describe('ProjectFormDialog', () => {
  let backend: HttpTestingController;
  const close = vi.fn();
  // Faux BrnDialogRef : close() observé, et no-op pour les enregistrements (titre, description…).
  const dialogRef = new Proxy({ close } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
  });

  async function render(project?: Project) {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProjectFormDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BrnDialogRef, useValue: dialogRef },
        // Contexte d'un dialogue Spartan = DIALOG_DATA du CDK
        { provide: DIALOG_DATA, useValue: { project } },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProjectFormDialog);
    await fixture.whenStable();
    backend
      .expectOne('/api/v1/tags')
      .flush([{ id: 't1', name: 'angular', color: null, usage: { projects: 0, notes: 0 } }]);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const submit = (element: HTMLElement) =>
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

  afterEach(() => backend.verify());

  it('crée un projet puis se ferme avec le projet renvoyé', async () => {
    const { element } = await render();
    expect(element.querySelector('h2')?.textContent).toContain('Nouveau projet');

    type(element, '#project-name', 'API Nest');
    type(element, '#project-stack', 'NestJS, Prisma');
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    submit(element);

    const request = backend.expectOne('/api/v1/projects');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      name: 'API Nest',
      status: 'IDEA',
      techStack: ['NestJS', 'Prisma'],
      tagIds: ['t1'],
    });
    const created = makeProject({ name: 'API Nest' });
    request.flush(created);

    expect(close).toHaveBeenCalledWith(created);
  });

  it('modifie un projet existant (PATCH) avec les valeurs pré-remplies', async () => {
    const { element } = await render(makeProject({ id: 'p9' }));
    expect(element.querySelector('h2')?.textContent).toContain('Modifier le projet');
    expect(element.querySelector<HTMLInputElement>('#project-name')!.value).toBe('DevMirror');

    type(element, '#project-name', 'DevMirror v2');
    submit(element);

    const request = backend.expectOne('/api/v1/projects/p9');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.name).toBe('DevMirror v2');
    request.flush(makeProject({ id: 'p9', name: 'DevMirror v2' }));
  });

  it('bloque l’envoi si le nom est vide ou un lien invalide', async () => {
    const { fixture, element } = await render();

    type(element, '#project-name', '   ');
    type(element, '#project-repo', 'github.com/sans-protocole');
    submit(element);
    await fixture.whenStable();

    backend.expectNone('/api/v1/projects');
    expect(element.textContent).toContain('Le nom est obligatoire');
    expect(element.textContent).toContain('Adresse http(s) attendue.');
  });

  it('affiche l’erreur de l’API sans fermer la fenêtre', async () => {
    const { fixture, element } = await render();

    type(element, '#project-name', 'X');
    submit(element);
    backend
      .expectOne('/api/v1/projects')
      .flush(
        { message: ['Lien du dépôt invalide (http ou https)'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Lien du dépôt invalide',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
