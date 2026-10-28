import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { SearchResults } from '@devmirror/api-client';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { ThemeStore } from '../theme/theme.store';
import { CommandPaletteDialog, SEARCH_DEBOUNCE } from './command-palette-dialog';

const results: SearchResults = {
  q: 'jwt',
  projects: [{ id: 'p1', name: 'Auth JWT', color: null, status: 'IDEA' }],
  tasks: [],
  notes: [{ id: 'n1', title: 'Pièges JWT', excerpt: '', pinned: false }],
};

describe('CommandPaletteDialog', () => {
  let backend: HttpTestingController;
  const close = vi.fn();
  // Faux BrnDialogRef : close() observé, no-op pour le reste.
  const dialogRef = new Proxy({ close } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
  });

  async function render() {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CommandPaletteDialog],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BrnDialogRef, useValue: dialogRef },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CommandPaletteDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#palette-input')!;
    return { fixture, element, input };
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const key = (input: HTMLInputElement, name: string) =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));
  const active = (element: HTMLElement) =>
    element.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim();

  afterEach(() => backend.verify());

  it('propose actions et pages sans saisie, sans appeler l’API', async () => {
    const { element } = await render();
    await wait(SEARCH_DEBOUNCE + 50);

    expect(element.textContent).toContain('Nouvelle note');
    expect(element.textContent).toContain('Aller à : Tableau de bord');
    backend.expectNone((r) => r.url === '/api/v1/search');
  });

  it('cherche après 200 ms de pause et affiche les résultats groupés', async () => {
    const { fixture, element, input } = await render();

    input.value = 'jwt';
    input.dispatchEvent(new Event('input'));
    await wait(SEARCH_DEBOUNCE - 100);
    backend.expectNone((r) => r.url === '/api/v1/search');
    await wait(150);

    const request = backend.expectOne((r) => r.url === '/api/v1/search');
    expect(request.request.params.get('q')).toBe('jwt');
    request.flush(results);
    await fixture.whenStable();

    const groups = Array.from(element.querySelectorAll('[role="group"] > p')).map((p) =>
      p.textContent?.trim(),
    );
    expect(groups).toEqual(['Projets', 'Notes']);
    expect(active(element)).toContain('Auth JWT');
    expect(input.getAttribute('aria-activedescendant')).toBe('project-p1');
  });

  it('↑/↓ déplacent l’option active (en boucle), Entrée ouvre le lien', async () => {
    const { fixture, element, input } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    input.value = 'note';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(active(element)).toContain('Nouvelle note');

    key(input, 'ArrowUp'); // remonte à la dernière entrée
    await fixture.whenStable();
    expect(active(element)).toContain('Aller à : Notes');

    key(input, 'Enter');
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/notes'], { queryParams: undefined });
    await wait(SEARCH_DEBOUNCE + 50);
    // « note » : 4 lettres, la recherche part aussi
    backend
      .expectOne((r) => r.url === '/api/v1/search')
      .flush({ ...results, projects: [], notes: [] });
  });

  it('bascule le thème depuis une commande', async () => {
    const { fixture, element, input } = await render();
    const theme = TestBed.inject(ThemeStore);
    theme.setMode('light');

    input.value = 'theme';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element.querySelector<HTMLElement>('#cmd-theme')!.click();

    expect(theme.mode()).toBe('dark');
    await wait(SEARCH_DEBOUNCE + 50);
    backend
      .expectOne((r) => r.url === '/api/v1/search')
      .flush({ ...results, projects: [], notes: [] });
  });

  it('signale l’absence de résultat', async () => {
    const { fixture, element, input } = await render();

    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    await wait(SEARCH_DEBOUNCE + 50);
    backend
      .expectOne((r) => r.url === '/api/v1/search')
      .flush({ q: 'zzzz', projects: [], tasks: [], notes: [] });
    await fixture.whenStable();

    expect(element.textContent).toContain('Aucun résultat pour « zzzz »');
  });
});
