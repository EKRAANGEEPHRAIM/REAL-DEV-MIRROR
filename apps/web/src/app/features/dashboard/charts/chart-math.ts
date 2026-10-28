import type { ActivityCalendar } from '@devmirror/api-client';

/** Jour AAAA-MM-JJ -> Date locale à minuit (évite le décalage d'un new Date(iso) en UTC). */
export function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('fr', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDay(day));
}

export function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' }).format(parseDay(day));
}

function addDays(day: string, days: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Graduations « rondes » de 0 à au moins `max` (pas de 1, 2 ou 5 × 10ⁿ), environ `count`
 * intervalles. Un axe vide va quand même de 0 à `count` pour garder une grille lisible.
 */
export function niceTicks(max: number, count = 4): number[] {
  const top = Math.max(max, count);
  const raw = top / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = 0; value < top + step; value += step) {
    ticks.push(Number(value.toFixed(10)));
    if (value >= top) break;
  }
  return ticks;
}

/** Niveau 0 (aucune action) à 4 (jours les plus actifs), proportionnel au maximum. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

export interface HeatCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** Index plat, pour la navigation au clavier. */
  index: number;
}

export interface HeatmapModel {
  /** Une colonne par semaine (lundi -> dimanche) ; la dernière s'arrête à aujourd'hui. */
  weeks: HeatCell[][];
  months: { label: string; column: number }[];
  cells: HeatCell[];
  max: number;
}

const monthFormatter = new Intl.DateTimeFormat('fr', { month: 'short' });

/** Grille de la heatmap : `from` est un lundi, les jours après `to` ne sont pas dessinés. */
export function buildHeatmap(calendar: ActivityCalendar): HeatmapModel {
  const counts = new Map(calendar.days.map((day) => [day.date, day.count]));
  const max = Math.max(0, ...calendar.days.map((day) => day.count));
  const weeks: HeatCell[][] = [];
  const cells: HeatCell[] = [];

  for (let day = calendar.from; day <= calendar.to; day = addDays(day, 1)) {
    const weekday = (parseDay(day).getDay() + 6) % 7;
    if (weekday === 0 || weeks.length === 0) weeks.push([]);
    const count = counts.get(day) ?? 0;
    const cell: HeatCell = { date: day, count, level: heatLevel(count, max), index: cells.length };
    weeks.at(-1)!.push(cell);
    cells.push(cell);
  }

  // Étiquette de mois sur la première colonne qui contient le 1er du mois.
  const months: { label: string; column: number }[] = [];
  weeks.forEach((week, column) => {
    const first = week.find((cell) => cell.date.endsWith('-01'));
    if (!first) return;
    // Trop près de l'étiquette précédente (ou du bord gauche) : on la saute.
    const previous = months.at(-1);
    if (previous && column - previous.column < 3) return;
    months.push({ label: monthFormatter.format(parseDay(first.date)), column });
  });
  return { weeks, months, cells, max };
}

/** Tableau de données de la heatmap : total d'actions par mois, du plus ancien au plus récent. */
export function monthlyTotals(calendar: ActivityCalendar): { month: string; count: number }[] {
  const formatter = new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric' });
  const totals = new Map<string, number>();
  for (let day = calendar.from; day <= calendar.to; day = addDays(day, 1)) {
    const key = day.slice(0, 7);
    if (!totals.has(key)) totals.set(key, 0);
  }
  for (const day of calendar.days) {
    const key = day.date.slice(0, 7);
    if (totals.has(key)) totals.set(key, totals.get(key)! + day.count);
  }
  return [...totals].map(([key, count]) => ({
    month: formatter.format(parseDay(`${key}-01`)),
    count,
  }));
}
