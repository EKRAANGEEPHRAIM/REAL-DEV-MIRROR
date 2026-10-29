import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { mockApi, type MockOptions } from './support/mock-api';

/** Largeurs couvertes : petit mobile, tablette, portable, grand écran. */
const WIDTHS = [360, 768, 1280, 1920] as const;

interface AuditedPage {
  name: string;
  path: string;
  options?: MockOptions;
}

const PAGES: AuditedPage[] = [
  { name: 'connexion', path: '/login', options: { authenticated: false } },
  { name: 'inscription', path: '/register', options: { authenticated: false } },
  { name: 'mot-de-passe-oublie', path: '/forgot-password', options: { authenticated: false } },
  { name: 'tableau-de-bord', path: '/dashboard' },
  { name: 'tableau-de-bord-vide', path: '/dashboard', options: { empty: true } },
  { name: 'projets', path: '/projects' },
  { name: 'projets-vide', path: '/projects', options: { empty: true } },
  { name: 'projet', path: '/projects/p1' },
  { name: 'taches', path: '/tasks' },
  { name: 'kanban', path: '/tasks?view=board' },
  { name: 'objectifs', path: '/goals' },
  { name: 'notes', path: '/notes' },
  { name: 'note', path: '/notes/n1' },
  { name: 'parametres', path: '/settings' },
];

/** Page prête : titre affiché et plus aucun squelette de chargement. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  // Laisse les graphiques mesurer leur largeur et les polices se charger.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

/**
 * Défilement horizontal de la page : largeur du document, et les premiers éléments qui
 * dépassent de la fenêtre (y compris les éléments positionnés qui échappent à un conteneur
 * défilant, comme un texte sr-only sans ancêtre `relative`).
 */
function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth <= width) return null;
    const culprits = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.getBoundingClientRect().right > scrollWidth - 2)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}`);
    return { width, scrollWidth, culprits };
  });
}

/**
 * Contenu rogné par un conteneur `overflow: hidden` (une carte, par ex.) : invisible pour le
 * contrôle précédent. Les troncatures voulues (« … », line-clamp) et les textes sr-only sont exclus.
 */
function clippedContent(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const style = getComputedStyle(el);
        if (!['hidden', 'clip'].includes(style.overflowX)) return false;
        if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') return false;
        if (el.clientWidth <= 1 || el.closest('.sr-only')) return false;
        return el.scrollWidth > el.clientWidth + 1;
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')} (${el.scrollWidth} > ${el.clientWidth})`,
      ),
  );
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations.map(
    (v) => `${v.impact} ${v.id} (${v.nodes.length}) : ${v.nodes[0]?.target.join(' ')}`,
  );
}

for (const audited of PAGES) {
  test.describe(audited.name, () => {
    for (const width of WIDTHS) {
      test(`${width} px : sans défilement horizontal ni violation d’accessibilité`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await mockApi(page, audited.options);
        await open(page, audited.path);

        if (process.env['AUDIT_SCREENSHOTS']) {
          await page.screenshot({
            path: `e2e-results/screens/${audited.name}-${width}.png`,
            fullPage: true,
          });
        }

        expect(await horizontalOverflow(page), 'défilement horizontal').toBeNull();
        expect(await clippedContent(page), 'contenu rogné').toEqual([]);
        expect(await axeViolations(page), 'violations axe').toEqual([]);
      });
    }

    test('anglais, 360 px : mise en page et accessibilité', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('devmirror.language', 'en'));
      await page.setViewportSize({ width: 360, height: 900 });
      await mockApi(page, audited.options);
      await open(page, audited.path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      if (process.env['AUDIT_SCREENSHOTS']) {
        await page.screenshot({
          path: `e2e-results/screens/${audited.name}-en.png`,
          fullPage: true,
        });
      }
      expect(await horizontalOverflow(page), 'défilement horizontal').toBeNull();
      expect(await clippedContent(page), 'contenu rogné').toEqual([]);
      expect(await axeViolations(page), 'violations axe').toEqual([]);
    });

    test('mode sombre : contrastes', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width: 1280, height: 900 });
      await mockApi(page, { ...audited.options, theme: 'dark' });
      await open(page, audited.path);
      if (process.env['AUDIT_SCREENSHOTS']) {
        await page.screenshot({
          path: `e2e-results/screens/${audited.name}-dark.png`,
          fullPage: true,
        });
      }
      expect(await axeViolations(page), 'violations axe').toEqual([]);
    });
  });
}
