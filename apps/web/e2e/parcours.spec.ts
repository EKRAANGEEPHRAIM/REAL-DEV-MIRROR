import { expect, type Page, test } from '@playwright/test';

/**
 * Parcours principal contre la vraie API et sa base (branche Neon de test) : inscription,
 * projet, tâches, tableau de bord, puis suppression du compte, qui nettoie la base.
 * Lancé avec E2E_API=1 (voir playwright.config.ts).
 */
test.skip(process.env['E2E_API'] !== '1', 'Parcours contre l’API : lancer avec E2E_API=1');

/** Jour local AAAA-MM-JJ dans `offset` jours (champ date du formulaire de tâche). */
function inDays(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function createTask(page: Page, title: string, dueDate?: string): Promise<void> {
  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titre *').fill(title);
  if (dueDate) await dialog.getByLabel('Échéance').fill(dueDate);
  await dialog.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title)).toBeVisible();
}

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const email = `parcours-${stamp}@web.e2e.devmirror.test`;
const password = 'Parcours2026!';
let accountDeleted = false;

/** Filet de sécurité : si le parcours échoue avant la suppression, le compte est effacé par l'API. */
test.afterEach(async ({ request }) => {
  if (accountDeleted) return;
  const login = await request.post('/api/v1/auth/login', { data: { email, password } });
  if (!login.ok()) return; // inscription jamais faite, ou compte déjà supprimé
  const { accessToken } = (await login.json()) as { accessToken: string };
  await request.delete('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { password },
  });
});

test('inscription → projet → tâches → tableau de bord → suppression du compte', async ({
  page,
}) => {
  test.slow(); // une vraie base distante : chaque appel compte
  const project = `Portfolio ${stamp}`;

  await test.step('inscription', async () => {
    await page.goto('/register');
    await page.getByLabel('Nom').fill('Grace Hopper');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mot de passe').fill(password);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Grace');
    // Compte neuf : rien à faire cette semaine, adresse à confirmer.
    await expect(page.getByText('Rien d’urgent : aucune échéance cette semaine.')).toBeVisible();
    await expect(page.getByText('Confirmez votre adresse')).toBeVisible();
  });

  await test.step('création d’un projet', async () => {
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Projets' })
      .click();
    await expect(page.getByText('Aucun projet pour l’instant')).toBeVisible();

    await page.getByRole('button', { name: 'Créer un projet' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom *').fill(project);
    await dialog.getByLabel('Description').fill('Créé par le parcours Playwright.');
    await dialog.getByRole('button', { name: 'Créer le projet' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('link', { name: project }).click();
    await expect(page.getByRole('heading', { level: 1, name: project })).toBeVisible();
    await expect(page.getByText('Aucune tâche pour l’instant.')).toBeVisible();
  });

  await test.step('tâches du projet', async () => {
    await createTask(page, 'Écrire la page d’accueil', inDays(2));
    await createTask(page, 'Configurer le déploiement');

    await page.getByRole('checkbox', { name: 'Terminer « Configurer le déploiement »' }).click();
    await expect(page.getByText('1 terminée sur 2 · 50 %')).toBeVisible();
  });

  await test.step('la session survit à un rechargement (cookie de refresh)', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: project })).toBeVisible();
    await expect(page.getByText('1 terminée sur 2 · 50 %')).toBeVisible();
  });

  await test.step('tableau de bord', async () => {
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Tableau de bord' })
      .click();
    const tile = (label: string) =>
      page
        .getByRole('region', { name: 'Indicateurs' })
        .locator('article, section, div')
        .filter({ hasText: label })
        .first();
    await expect(tile('Projets actifs')).toContainText('1');
    await expect(tile('Tâches terminées cette semaine')).toContainText('1');

    const dueSoon = page.getByRole('region', { name: 'À faire sous 7 jours' });
    await expect(dueSoon.getByText('Écrire la page d’accueil')).toBeVisible();
    await expect(dueSoon.getByText(project)).toBeVisible();
  });

  await test.step('suppression du compte', async () => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Supprimer mon compte…' }).click();
    // Confirmation destructive : alertdialog, pas un simple dialog.
    const dialog = page.getByRole('alertdialog');
    await dialog.getByLabel('Mot de passe, pour confirmer').fill(password);
    await dialog.getByRole('button', { name: 'Supprimer mon compte' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Votre compte a été supprimé.')).toBeVisible();
    accountDeleted = true;
  });

  await test.step('le compte supprimé ne peut plus se connecter', async () => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mot de passe').fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
