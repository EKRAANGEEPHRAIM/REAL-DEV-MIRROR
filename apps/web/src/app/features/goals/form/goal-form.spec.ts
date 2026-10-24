import { DIALOG_DATA } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Goal } from '@devmirror/api-client';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { of } from 'rxjs';
import { makeGoal, makeMilestone } from '../../../../testing/goal-fixtures';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { GoalFormDialog } from './goal-form-dialog';

describe('GoalFormDialog', () => {
  let backend: HttpTestingController;
  const close = vi.fn();
  const confirm = { confirm: vi.fn() };
  // Faux BrnDialogRef : close() observé, no-op pour les enregistrements (titre, description…).
  const dialogRef = new Proxy({ close } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
  });

  async function render(goal?: Goal) {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [GoalFormDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BrnDialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { goal } },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GoalFormDialog);
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({
        data: [
          { id: 'p1', name: 'DevMirror', color: null },
          { id: 'p2', name: 'Portfolio', color: '#6366f1' },
        ],
        meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
      });
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const button = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  const checkbox = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('label'))
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input')!;
  const submit = (element: HTMLElement) =>
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

  async function addMilestone(
    fixture: { whenStable(): Promise<unknown> },
    element: HTMLElement,
    title: string,
  ) {
    type(element, '#new-milestone', title);
    await fixture.whenStable();
    button(element, 'Ajouter').click();
    await fixture.whenStable();
  }

  afterEach(() => backend.verify());

  it('crée l’objectif avec ses jalons et ses projets en une seule requête', async () => {
    const { fixture, element } = await render();

    type(element, '#goal-title', 'Décrocher une mission');
    type(element, '#goal-target', '2026-12-15');
    await addMilestone(fixture, element, 'Portfolio à jour');
    await addMilestone(fixture, element, 'Profil Malt');
    checkbox(element, 'Portfolio').dispatchEvent(new Event('change'));
    submit(element);

    const create = backend.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/goals');
    expect(create.request.body).toEqual({
      title: 'Décrocher une mission',
      description: null,
      targetDate: new Date(2026, 11, 15, 23, 59, 59, 999).toISOString(),
      projectIds: ['p2'],
      milestones: ['Portfolio à jour', 'Profil Malt'],
    });
    const created = makeGoal({ id: 'new' });
    create.flush(created);

    expect(close).toHaveBeenCalledWith({ type: 'saved', goal: created });
  });

  it('coche après création les jalons déjà cochés dans le formulaire', async () => {
    const { fixture, element } = await render();

    type(element, '#goal-title', 'Lancer DevMirror');
    await addMilestone(fixture, element, 'API');
    await addMilestone(fixture, element, 'Front');
    element
      .querySelector<HTMLInputElement>('li input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));
    submit(element);

    backend
      .expectOne((r) => r.method === 'POST')
      .flush(
        makeGoal({
          id: 'new',
          milestones: [
            makeMilestone({ id: 'm1', title: 'API' }),
            makeMilestone({ id: 'm2', title: 'Front', position: 1 }),
          ],
        }),
      );
    const patch = backend.expectOne('/api/v1/goals/new/milestones/m1');
    expect(patch.request.body).toEqual({ done: true });
    patch.flush(makeMilestone({ id: 'm1', done: true }));
    const full = makeGoal({ id: 'new', title: 'Relu' });
    backend.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/goals/new').flush(full);

    expect(close).toHaveBeenCalledWith({ type: 'saved', goal: full });
  });

  it('en modification, enregistre chaque jalon aussitôt et le signale à la fermeture', async () => {
    const goal = makeGoal({
      id: 'g1',
      projects: [{ id: 'p1', name: 'DevMirror', color: null }],
      milestones: [makeMilestone({ id: 'm1', title: 'Portfolio' })],
    });
    const { fixture, element } = await render(goal);
    expect(checkbox(element, 'DevMirror').checked).toBe(true);

    element
      .querySelector<HTMLInputElement>('li input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));
    const toggle = backend.expectOne('/api/v1/goals/g1/milestones/m1');
    expect(toggle.request.body).toEqual({ done: true });
    toggle.flush(makeMilestone({ id: 'm1', done: true }));

    await addMilestone(fixture, element, 'Candidatures');
    backend
      .expectOne((r) => r.method === 'POST' && r.url === '/api/v1/goals/g1/milestones')
      .flush(makeMilestone({ id: 'm2', title: 'Candidatures', position: 1 }));
    await fixture.whenStable();
    expect(element.textContent).toContain('(1/2)');

    button(element, 'Annuler').click();
    expect(close).toHaveBeenCalledWith({ type: 'changed' });
  });

  it('bloque l’envoi sans titre', async () => {
    const { fixture, element } = await render();

    submit(element);
    await fixture.whenStable();

    backend.expectNone((r) => r.method === 'POST');
    expect(element.textContent).toContain('Le titre est obligatoire');
  });

  it('supprime l’objectif après confirmation', async () => {
    confirm.confirm.mockReturnValue(of(true));
    const { element } = await render(makeGoal({ id: 'g1' }));

    button(element, 'Supprimer').click();
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(close).toHaveBeenCalledWith({ type: 'deleted', id: 'g1' });
  });
});
