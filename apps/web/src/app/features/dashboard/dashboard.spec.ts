import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { makeOverview } from '../../../testing/stats-fixtures';
import { AuthStore } from '../../core/auth/auth.store';
import { DashboardStore } from './data/dashboard.store';
import { DashboardPage } from './dashboard.page';

describe('Tableau de bord', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Le vrai AuthStore restaure la session au démarrage (POST /auth/refresh).
        { provide: AuthStore, useValue: { user: signal({ name: 'Ada Lovelace' }) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  const overviewRequest = () => backend.expectOne((r) => r.url === '/api/v1/stats/overview');
  const text = () => harness.routeNativeElement!.textContent ?? '';

  it('fait une seule requête, avec le fuseau du navigateur, et affiche les 4 tuiles', async () => {
    await harness.navigateByUrl('/dashboard');

    const request = overviewRequest();
    expect(request.request.params.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    request.flush(makeOverview({ activeProjects: 3, currentStreak: 4, longestStreak: 9 }));
    harness.detectChanges();

    const tiles = harness.routeNativeElement!.querySelectorAll('dm-dashboard-tile');
    expect(tiles).toHaveLength(4);
    expect(tiles[0].textContent).toContain('Projets actifs');
    expect(tiles[0].textContent).toContain('3');
    // Valeur et unité dans deux éléments distincts
    expect(tiles[3].textContent).toMatch(/4\s*jours/);
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toMatch(
      /^(Bonjour|Bonsoir), Ada$/,
    );
    expect(
      harness.routeNativeElement!.querySelector('a[href="/projects?status=IN_PROGRESS"]'),
    ).not.toBeNull();
    // Graphiques et heatmap alimentés par la même réponse : aucune autre requête
    const root = harness.routeNativeElement!;
    expect(root.querySelector('dm-weekly-tasks-chart')).not.toBeNull();
    expect(root.querySelector('dm-project-status-chart')).not.toBeNull();
    expect(root.querySelector('dm-activity-heatmap')).not.toBeNull();
    // Tableaux de données : 12 semaines, et un total par mois
    expect(root.querySelectorAll('[aria-labelledby="weekly-heading"] tbody tr')).toHaveLength(12);
    expect(
      root.querySelectorAll('[aria-labelledby="activity-heading"] tbody tr').length,
    ).toBeGreaterThanOrEqual(12);
    backend.expectNone(() => true);
  });

  it('signale les tâches en retard avec un lien vers la liste filtrée', async () => {
    await harness.navigateByUrl('/dashboard');
    overviewRequest().flush(makeOverview({ overdueTasks: 2 }));
    harness.detectChanges();

    const alert = harness.routeNativeElement!.querySelector<HTMLAnchorElement>(
      'a[href="/tasks?due=overdue"]',
    );
    expect(alert?.textContent).toContain('2 tâches en retard');
  });

  it('affiche l’erreur puis réessaie ; garde les chiffres pendant une actualisation', async () => {
    await harness.navigateByUrl('/dashboard');
    overviewRequest().flush({ message: 'Base indisponible' }, { status: 503, statusText: 'KO' });
    harness.detectChanges();
    expect(text()).toContain('Base indisponible');

    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Réessayer'))!
      .click();
    overviewRequest().flush(makeOverview());
    harness.detectChanges();
    expect(text()).toContain('Projets actifs');

    const store = TestBed.inject(DashboardStore);
    store.load();
    expect(store.isRefreshing()).toBe(true);
    expect(store.tiles()).toHaveLength(4);
    overviewRequest().flush(makeOverview());
  });

  it('une seule requête HTTP pour tout le tableau de bord (tuiles, listes, graphiques)', async () => {
    await harness.navigateByUrl('/dashboard');

    const pending = backend.match(() => true);
    expect(pending.map((r) => r.request.url)).toEqual(['/api/v1/stats/overview']);
    pending[0].flush(
      makeOverview(
        {},
        {
          dueSoon: [
            {
              id: 't1',
              title: 'Préparer la démo',
              dueDate: new Date(Date.now() + 86_400_000).toISOString(),
              status: 'TODO',
              priority: 'HIGH',
              project: null,
            },
          ],
          recentNotes: [
            {
              id: 'n1',
              title: 'Pièges JWT',
              excerpt: '',
              pinned: false,
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ),
    );
    harness.detectChanges();

    expect(text()).toContain('Préparer la démo');
    expect(text()).toContain('Pièges JWT');
    backend.expectNone(() => true);
  });

  it('terminer une tâche : retirée aussitôt, puis chiffres relus ; remise en cas d’échec', async () => {
    const task = {
      id: 't1',
      title: 'Préparer la démo',
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      project: null,
    };
    await harness.navigateByUrl('/dashboard');
    overviewRequest().flush(makeOverview({}, { dueSoon: [task] }));
    const store = TestBed.inject(DashboardStore);

    store.completeTask(task);
    expect(store.overview()?.dueSoon).toEqual([]);
    const update = backend.expectOne('/api/v1/tasks/t1');
    expect(update.request.body).toEqual({ status: 'DONE' });
    update.flush({ ...task, status: 'DONE' });
    // Tuiles, graphiques et série changent : la vue d'ensemble est relue
    overviewRequest().flush(makeOverview({ tasksCompletedThisWeek: 1 }));
    expect(store.overview()?.indicators.tasksCompletedThisWeek).toBe(1);

    store.completeTask(task);
    backend
      .expectOne('/api/v1/tasks/t1')
      .flush({ message: 'Refusé' }, { status: 500, statusText: 'KO' });
    expect(store.overview()?.dueSoon).toEqual([task]);
  });
});
