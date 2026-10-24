import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { goalPage, makeGoal, makeMilestone } from '../../../../testing/goal-fixtures';
import { GoalsPage } from './goals.page';

describe('GoalsPage', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'goals', component: GoalsPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  const goalsRequest = () => backend.expectOne((r) => r.url === '/api/v1/goals');
  const text = () => harness.routeNativeElement!.textContent ?? '';

  it('lit les filtres dans l’URL et affiche progression, jalons et projets', async () => {
    await harness.navigateByUrl('/goals?state=active&q=mission');

    const request = goalsRequest();
    expect(request.request.params.get('state')).toBe('active');
    expect(request.request.params.get('q')).toBe('mission');
    expect(request.request.params.get('sort')).toBe('targetDate:asc');
    request.flush(
      goalPage([
        makeGoal({
          title: 'Décrocher une mission',
          milestones: [
            makeMilestone({ id: 'm1', title: 'Portfolio', done: true }),
            makeMilestone({ id: 'm2', title: 'Profil Malt' }),
          ],
          projects: [{ id: 'p1', name: 'Portfolio Astro', color: null }],
        }),
      ]),
    );
    harness.detectChanges();

    expect(text()).toContain('Décrocher une mission');
    expect(text()).toContain('1/2 jalons');
    expect(text()).toContain('50 %');
    expect(text()).toContain('Portfolio Astro');
    const pressed = harness.routeNativeElement!.querySelector('[aria-pressed="true"]');
    expect(pressed?.textContent?.trim()).toBe('En cours');
  });

  it('coche un jalon depuis la carte', async () => {
    await harness.navigateByUrl('/goals');
    goalsRequest().flush(
      goalPage([makeGoal({ id: 'g1', milestones: [makeMilestone({ id: 'm1', title: 'API' })] })]),
    );
    harness.detectChanges();

    harness
      .routeNativeElement!.querySelector<HTMLInputElement>('ul input[type="checkbox"]')!
      .dispatchEvent(new Event('change'));
    const request = backend.expectOne('/api/v1/goals/g1/milestones/m1');
    expect(request.request.body).toEqual({ done: true });
    request.flush(makeMilestone({ id: 'm1', done: true }));
    harness.detectChanges();

    expect(text()).toContain('Atteint');
    expect(text()).toContain('100 %');
  });

  it('un onglet d’état met à jour l’URL ; état vide avec ou sans filtre', async () => {
    await harness.navigateByUrl('/goals');
    goalsRequest().flush(goalPage([]));
    harness.detectChanges();
    expect(text()).toContain('Aucun objectif pour l’instant');

    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Atteints')!
      .click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/goals?state=completed');
    goalsRequest().flush(goalPage([]));
    harness.detectChanges();
    expect(text()).toContain('Aucun objectif ne correspond');
  });
});
