import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeNote } from '../../../../testing/note-fixtures';
import { AUTOSAVE_DELAY, NoteEditorStore } from './note-editor.store';

describe('NoteEditorStore', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [NoteEditorStore, provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  function loadedStore() {
    const store = TestBed.inject(NoteEditorStore);
    store.load('n1');
    backend.expectOne('/api/v1/notes/n1').flush(makeNote({ id: 'n1', content: 'Début' }));
    return store;
  }

  const saveRequest = () =>
    backend.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/notes/n1');

  it('enregistre une seconde après la dernière frappe, en une seule requête', () => {
    const store = loadedStore();

    store.edit({ content: 'Début, suite' });
    vi.advanceTimersByTime(AUTOSAVE_DELAY - 100);
    store.edit({ title: '  JWT  ' });
    store.edit({ content: 'Début, suite et fin' });
    expect(store.save()).toBe('pending');
    expect(store.content()).toBe('Début, suite et fin');

    vi.advanceTimersByTime(AUTOSAVE_DELAY - 1);
    backend.expectNone((r) => r.method === 'PATCH');
    vi.advanceTimersByTime(1);

    const request = saveRequest();
    expect(request.request.body).toEqual({ title: 'JWT', content: 'Début, suite et fin' });
    expect(store.save()).toBe('saving');
    request.flush(makeNote({ id: 'n1', updatedAt: '2026-10-24T10:00:00.000Z' }));
    expect(store.save()).toBe('saved');
    expect(store.savedAt()).toBe('2026-10-24T10:00:00.000Z');
  });

  it('garde la frappe faite pendant un enregistrement pour le suivant', () => {
    const store = loadedStore();

    store.edit({ content: 'v1' });
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    const first = saveRequest();

    store.edit({ content: 'v2' });
    first.flush(makeNote({ id: 'n1', content: 'v1' }));
    expect(store.save()).toBe('pending');
    // Le brouillon affiché n'est pas écrasé par la réponse
    expect(store.content()).toBe('v2');

    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    const second = saveRequest();
    expect(second.request.body).toEqual({ content: 'v2' });
    second.flush(makeNote({ id: 'n1', content: 'v2' }));
    expect(store.save()).toBe('saved');
  });

  it('en cas d’échec, conserve les modifications et les renvoie avec « Réessayer »', () => {
    const store = loadedStore();

    store.edit({ content: 'important' });
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    saveRequest().flush({ message: 'Hors ligne' }, { status: 503, statusText: 'Unavailable' });
    expect(store.save()).toBe('error');
    expect(store.saveError()).toBe('Hors ligne');
    expect(store.hasUnsavedChanges()).toBe(true);

    store.saveNow();
    vi.advanceTimersByTime(0);
    const retry = saveRequest();
    expect(retry.request.body).toEqual({ content: 'important' });
    retry.flush(makeNote({ id: 'n1' }));
    expect(store.save()).toBe('saved');
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it('n’envoie pas un titre vide : il reste en attente', () => {
    const store = loadedStore();

    store.edit({ title: '   ' });
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    backend.expectNone((r) => r.method === 'PATCH');
    expect(store.titleInvalid()).toBe(true);
    expect(store.save()).toBe('pending');

    store.edit({ content: 'contenu' });
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    expect(saveRequest().request.body).toEqual({ content: 'contenu' });
  });

  it('Ctrl+S enregistre sans attendre ; quitter la page envoie ce qui reste', () => {
    const store = loadedStore();

    store.edit({ content: 'vite' });
    store.saveNow();
    vi.advanceTimersByTime(0);
    saveRequest().flush(makeNote({ id: 'n1' }));

    store.edit({ content: 'dernier mot' });
    store.flushOnLeave();
    expect(saveRequest().request.body).toEqual({ content: 'dernier mot' });
  });

  it('les réglages (épinglage, projet, tags) partent aussitôt, sans toucher au brouillon', () => {
    const store = loadedStore();
    store.edit({ content: 'brouillon' });

    store.updateMeta({ pinned: true });
    const request = saveRequest();
    expect(request.request.body).toEqual({ pinned: true });
    request.flush(makeNote({ id: 'n1', pinned: true, content: 'Début' }));

    expect(store.note()?.pinned).toBe(true);
    expect(store.content()).toBe('brouillon');
    vi.advanceTimersByTime(AUTOSAVE_DELAY);
    saveRequest().flush(makeNote({ id: 'n1' }));
  });

  it('signale une note introuvable', () => {
    const store = TestBed.inject(NoteEditorStore);
    store.load('inconnue');
    backend
      .expectOne('/api/v1/notes/inconnue')
      .flush({ message: 'Note introuvable' }, { status: 404, statusText: 'Not Found' });
    expect(store.status()).toBe('not-found');
  });
});
