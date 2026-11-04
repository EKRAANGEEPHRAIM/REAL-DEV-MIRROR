// Mesure Lighthouse (mobile, réseau et CPU bridés) des pages principales, sur le build de
// production servi par serve-dist.mjs et l'API locale (base de test), comme le parcours e2e :
//   E2E_API=1 pnpm exec playwright test --project=parcours   (démarre puis arrête les serveurs)
// ou serveurs lancés à la main, puis : node e2e/support/lighthouse.mjs
// Un compte temporaire est créé, rempli, mesuré puis supprimé.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const BASE = process.env.BASE_URL ?? 'http://localhost:4300';
const PORT = 9333;
const OUT = 'e2e-results/lighthouse';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

mkdirSync(OUT, { recursive: true });
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lh-')), {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
});

const results = [];
// RUNS=3 : chaque page est mesurée 3 fois et la médiane est retenue (Lighthouse varie d'un passage
// à l'autre). FORM_FACTOR=desktop : profil ordinateur au lieu du profil mobile bridé.
const RUNS = Number(process.env.RUNS ?? 1);
const config =
  process.env.FORM_FACTOR === 'desktop'
    ? (await import('lighthouse/core/config/desktop-config.js')).default
    : undefined;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function audit(name, path, beforeEach = async () => undefined) {
  const runs = [];
  let lhr;
  for (let i = 0; i < RUNS; i++) {
    await beforeEach();
    const result = await lighthouse(
      `${BASE}${path}`,
      {
        port: PORT,
        output: 'html',
        onlyCategories: CATEGORIES,
        // Garde le cookie de session entre deux mesures (pages connectées).
        disableStorageReset: true,
      },
      config,
    );
    lhr = result.lhr;
    writeFileSync(join(OUT, `${name}.html`), result.report);
    runs.push({
      ...Object.fromEntries(
        CATEGORIES.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)]),
      ),
      LCP: lhr.audits['largest-contentful-paint'].numericValue,
      TBT: lhr.audits['total-blocking-time'].numericValue,
      CLS: lhr.audits['cumulative-layout-shift'].numericValue,
    });
  }
  const pick = (key) => median(runs.map((r) => r[key]));
  results.push({
    page: name,
    ...Object.fromEntries(CATEGORIES.map((c) => [c, pick(c)])),
    'LCP (s)': (pick('LCP') / 1000).toFixed(1),
    'TBT (ms)': Math.round(pick('TBT')),
    CLS: pick('CLS').toFixed(2),
  });
  const audits = lhr.audits; // Pistes d'amélioration de la performance, les plus coûteuses d'abord.
  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.numericValue ?? 0) > 100)
    .map((a) => `${a.title} (${Math.round(a.numericValue)} ms)`);
  if (opportunities.length) console.log(`${name} — pistes : ${opportunities.join(' ; ')}`);
  const failed = Object.values(audits)
    .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
    .map((a) => a.id);
  if (failed.length) console.log(`${name} — audits échoués : ${failed.join(', ')}`);
  if (process.env.LH_DETAILS) {
    const items = (id) => audits[id]?.details?.items ?? [];
    for (const e of items('errors-in-console'))
      console.log(`  console : ${e.description} ${e.sourceLocation?.url ?? ''}`);
    for (const s of items('bootup-time').slice(0, 4)) {
      console.log(
        `  CPU : ${Math.round(s.scripting)} ms script, ${Math.round(s.scriptParseCompile)} ms parse — ${s.url}`,
      );
    }
    for (const g of items('mainthread-work-breakdown').slice(0, 4)) {
      console.log(`  thread : ${g.groupLabel} ${Math.round(g.duration)} ms`);
    }
    const lcp = audits['largest-contentful-paint-element']?.details?.items ?? [];
    for (const block of lcp) {
      for (const it of block.items ?? []) {
        if (it.node) console.log(`  LCP élément : ${it.node.nodeLabel} (${it.node.selector})`);
        if (it.phase) console.log(`  LCP phase ${it.phase} : ${Math.round(it.timing)} ms`);
      }
    }
    for (const t of items('long-tasks').slice(0, 4))
      console.log(`  tâche longue : ${Math.round(t.duration)} ms — ${t.url}`);
  }
}

const stamp = Date.now();
const account = {
  name: 'Lighthouse',
  email: `lighthouse-${stamp}@web.e2e.devmirror.test`,
  password: 'Lighthouse2026!',
};
const api = context.request;
let token;

try {
  await audit('connexion', '/login');
  await audit('inscription', '/register');

  // Compte de mesure avec des données réalistes ; le cookie de refresh reste dans le profil.
  const registered = await api.post(`${BASE}/api/v1/auth/register`, { data: account });
  if (!registered.ok()) throw new Error(`inscription : ${registered.status()}`);
  token = (await registered.json()).accessToken;
  // Inscription faite par l'API : on pose l'indice de session que l'app poserait elle-même.
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.setItem('devmirror.session', '1'));
  await page.close();
  const headers = { Authorization: `Bearer ${token}` };
  const post = async (path, data) =>
    (await api.post(`${BASE}/api/v1${path}`, { headers, data })).json();

  const projects = [];
  for (const name of ['DevMirror', 'Portfolio', 'CLI de déploiement']) {
    projects.push(
      await post('/projects', {
        name,
        description: `Projet ${name}`,
        techStack: ['Angular', 'NestJS'],
      }),
    );
  }
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  for (let i = 0; i < 9; i++) {
    const task = await post('/tasks', {
      title: `Tâche ${i + 1}`,
      projectId: projects[i % 3].id,
      dueDate: day(i - 2),
      priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
    });
    if (i % 3 === 0) {
      await api.patch(`${BASE}/api/v1/tasks/${task.id}`, { headers, data: { status: 'DONE' } });
    }
  }
  for (const title of ['Rotation des refresh tokens', 'Signals et RxJS']) {
    await post('/notes', { title, content: `# ${title}\n\nNotes **Markdown** avec du \`code\`.` });
  }

  // Nouvelle connexion avant chaque page : l'audit bf-cache de Lighthouse quitte la page puis y
  // revient, ce qui peut laisser un cookie de refresh déjà utilisé (rejeté ensuite par l'API).
  const login = () =>
    api.post(`${BASE}/api/v1/auth/login`, {
      data: { email: account.email, password: account.password },
    });
  for (const [name, path] of [
    ['tableau-de-bord', '/dashboard'],
    ['projets', '/projects'],
    ['taches', '/tasks'],
    ['notes', '/notes'],
  ]) {
    await audit(name, path, login);
  }
} finally {
  if (token) {
    await api.delete(`${BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { password: account.password },
    });
  }
  await context.close();
}

console.table(results);
writeFileSync(join(OUT, 'scores.json'), JSON.stringify(results, null, 2));
