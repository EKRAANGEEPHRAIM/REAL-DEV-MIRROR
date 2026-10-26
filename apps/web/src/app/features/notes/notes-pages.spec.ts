import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { makeNote, makeNoteSummary, notePage } from '../../../testing/note-fixtures';
import { NoteEditorPage } from './editor/note-editor.page';
import { NotesPage } from './list/notes.page';

describe('Pages des notes', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'notes', component: NotesPage },
            { path: 'notes/:id', component: NoteEditorPage },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  const root = () => harness.routeNativeElement!;
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  async function openEditor(content: string) {
    await harness.navigateByUrl('/notes/n1');
    backend.expectOne('/api/v1/notes/n1').flush(makeNote({ id: 'n1', content }));
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } });
    backend.expectOne('/api/v1/tags').flush([{ id: 't1', name: 'nestjs', color: null }]);
    await harness.fixture.whenStable();
  }

  const tag = (name: string, notes: number) => ({
    id: `t-${name}`,
    name,
    color: null,
    usage: { projects: 0, notes },
  });
  const notesRequest = () => backend.expectOne((r) => r.url === '/api/v1/notes');

  async function openList(url: string, notes = notePage([])) {
    await harness.navigateByUrl(url);
    backend.expectOne('/api/v1/tags').flush([tag('nestjs', 2), tag('vide', 0)]);
    const request = notesRequest();
    request.flush(notes);
    harness.detectChanges();
    return request;
  }

  it('sépare les épinglées des autres notes ; extrait et lien vers l’éditeur', async () => {
    await openList(
      '/notes',
      notePage([
        makeNoteSummary({ id: 'n1', pinned: true, title: 'JWT' }),
        makeNoteSummary({ id: 'n2', title: 'Signals' }),
      ]),
    );

    const sections = root().querySelectorAll('section');
    expect(sections[0].querySelector('h2')?.textContent).toContain('Épinglées');
    expect(sections[0].textContent).toContain('JWT');
    expect(sections[1].querySelector('h2')?.textContent).toContain('Autres notes');
    expect(sections[1].textContent).toContain('Signals');
    expect(root().textContent).toContain('Un refresh token ne sert qu’une fois.');
    expect(root().querySelector('a[href="/notes/n1"]')).not.toBeNull();
    // Seuls les tags portés par une note servent de filtre
    expect(root().textContent).toContain('#nestjs');
    expect(root().textContent).not.toContain('#vide');
  });

  it('lit recherche, tag et tri dans l’URL ; un clic sur un tag filtre', async () => {
    const request = await openList(
      '/notes?q=jwt&tag=nestjs',
      notePage([
        makeNoteSummary({ id: 'n1', tags: [{ id: 't-nestjs', name: 'nestjs', color: null }] }),
      ]),
    );
    expect(request.request.params.get('q')).toBe('jwt');
    expect(request.request.params.get('tag')).toBe('nestjs');
    expect(request.request.params.has('sort')).toBe(false); // pertinence
    expect(root().querySelector('#note-sort option')?.textContent?.trim()).toBe('Pertinence');

    // Un second clic sur le tag actif retire le filtre
    root()
      .querySelector<HTMLButtonElement>('[role="group"] [aria-pressed="true"]:not(:first-child)')!
      .click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/notes?q=jwt');
    notesRequest().flush(notePage([]));
    harness.detectChanges();
    expect(root().textContent).toContain('Aucune note ne correspond');
  });

  it('épingle une note depuis la liste, puis relit la page', async () => {
    await openList('/notes', notePage([makeNoteSummary({ id: 'n1', title: 'JWT' })]));

    root().querySelector<HTMLButtonElement>('[aria-label="Épingler « JWT »"]')!.click();
    const request = backend.expectOne((r) => r.method === 'PATCH');
    expect(request.request.body).toEqual({ pinned: true });
    harness.detectChanges();
    expect(root().querySelector('[aria-label="Désépingler « JWT »"]')).not.toBeNull();

    request.flush(makeNote({ id: 'n1', pinned: true }));
    notesRequest().flush(notePage([makeNoteSummary({ id: 'n1', pinned: true })]));
  });

  it('« Nouvelle note » crée une note puis ouvre l’éditeur', async () => {
    await openList('/notes');

    button('Nouvelle note').click();
    const create = backend.expectOne((r) => r.method === 'POST');
    expect(create.request.body).toEqual({ title: 'Sans titre' });
    create.flush(makeNote({ id: 'new', title: 'Sans titre', content: '' }));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/notes/new');
    backend
      .expectOne('/api/v1/notes/new')
      .flush(makeNote({ id: 'new', title: 'Sans titre', content: '' }));
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } });
    backend.expectOne('/api/v1/tags').flush([]);
  });

  it('éditeur : aperçu Markdown, mise en forme et Ctrl+S', async () => {
    await openEditor('# Rotation\n\n```ts\nconst a = 1;\n```');

    const preview = root().querySelector('[aria-label="Aperçu"]')!;
    expect(preview.querySelector('h1')?.textContent).toBe('Rotation');
    expect(preview.querySelector('code.hljs')).not.toBeNull();

    const textarea = root().querySelector<HTMLTextAreaElement>('#note-content')!;
    textarea.setSelectionRange(2, 10);
    root().querySelector<HTMLButtonElement>('[aria-label="Gras"]')!.click();
    expect(textarea.value.startsWith('# **Rotation**')).toBe(true);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    // Ctrl+S passe par un timer rxjs de 0 ms, que whenStable n'attend pas (zoneless).
    await new Promise((resolve) => setTimeout(resolve, 0));
    const save = backend.expectOne((r) => r.method === 'PATCH');
    expect(save.request.body.content.startsWith('# **Rotation**')).toBe(true);
    save.flush(makeNote({ id: 'n1' }));
  });

  it('éditeur : bascule de vue et tag ajouté aussitôt', async () => {
    await openEditor('Texte');

    button('Aperçu').click();
    await harness.fixture.whenStable();
    expect(root().querySelector('#note-content')).toBeNull();

    button('#nestjs').click();
    const request = backend.expectOne((r) => r.method === 'PATCH');
    expect(request.request.body).toEqual({ tagIds: ['t1'] });
    request.flush(makeNote({ id: 'n1', tags: [{ id: 't1', name: 'nestjs', color: null }] }));
    await harness.fixture.whenStable();
    expect(button('#nestjs').getAttribute('aria-pressed')).toBe('true');
  });
});
