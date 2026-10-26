import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Tag } from '@devmirror/api-client';
import { of } from 'rxjs';
import { ConfirmService } from '../../shared/ui-kit/confirm-dialog';
import { normalizeTagName, tagUsageLabel, TagsSettings } from './tags/tags-settings';

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 't1',
  name: 'nestjs',
  color: null,
  usage: { projects: 0, notes: 0 },
  ...overrides,
});

describe('helpers des tags', () => {
  it('normalise le nom comme l’API', () => {
    expect(normalizeTagName('  Angular   Signals ')).toBe('angular signals');
  });

  it('décrit l’utilisation d’un tag', () => {
    expect(tagUsageLabel(makeTag({ usage: { projects: 2, notes: 1 } }))).toBe('2 projets · 1 note');
    expect(tagUsageLabel(makeTag({ usage: { projects: 0, notes: 3 } }))).toBe('3 notes');
    expect(tagUsageLabel(makeTag())).toBe('Inutilisé');
  });
});

describe('TagsSettings', () => {
  let backend: HttpTestingController;
  const confirm = { confirm: vi.fn() };

  async function render(tags: Tag[]) {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [TagsSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmService, useValue: confirm },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TagsSettings);
    await fixture.whenStable();
    backend.expectOne('/api/v1/tags').flush(tags);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  const byLabel = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

  afterEach(() => backend.verify());

  it('liste les tags triés, avec leur utilisation', async () => {
    const { element } = await render([
      makeTag({ id: 't2', name: 'vitest' }),
      makeTag({ id: 't1', name: 'angular', usage: { projects: 1, notes: 2 } }),
    ]);

    const rows = Array.from(element.querySelectorAll('li')).map((li) => li.textContent);
    expect(rows[0]).toContain('#angular');
    expect(rows[0]).toContain('1 projet · 2 notes');
    expect(rows[1]).toContain('#vitest');
  });

  it('crée un tag avec sa couleur ; affiche l’erreur de l’API', async () => {
    const { fixture, element } = await render([]);

    type(element, '#new-tag', '  Prisma  ');
    byLabel(element, 'Violet').click();
    await fixture.whenStable();
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = backend.expectOne((r) => r.method === 'POST');
    expect(request.request.body).toEqual({ name: 'prisma', color: '#8b5cf6' });
    request.flush({ message: 'Un tag porte déjà ce nom' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(element.textContent).toContain('Un tag porte déjà ce nom');
  });

  it('renomme un tag sur place', async () => {
    const { fixture, element } = await render([makeTag()]);

    byLabel(element, 'Modifier le tag nestjs').click();
    await fixture.whenStable();
    type(element, '#tag-name-t1', 'NestJS 11');
    await fixture.whenStable();
    element.querySelector('li form')!.dispatchEvent(new Event('submit'));

    const request = backend.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/tags/t1');
    expect(request.request.body).toEqual({ name: 'nestjs 11', color: null });
    request.flush(makeTag({ name: 'nestjs 11' }));
    await fixture.whenStable();
    expect(element.textContent).toContain('#nestjs 11');
    expect(element.querySelector('#tag-name-t1')).toBeNull();
  });

  it('supprime après confirmation, en précisant ce qui l’utilise', async () => {
    confirm.confirm.mockReturnValue(of(true));
    const { fixture, element } = await render([makeTag({ usage: { projects: 1, notes: 0 } })]);

    byLabel(element, 'Supprimer le tag nestjs').click();
    expect(confirm.confirm.mock.calls[0][0].description).toContain('1 projet');
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(element.textContent).toContain('Aucun tag pour l’instant');
  });
});
