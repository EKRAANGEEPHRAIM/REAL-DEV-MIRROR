/**
 * Calcul de calendrier pour les statistiques. Les jours sont des chaînes AAAA-MM-JJ dans le
 * fuseau de l'utilisateur ; l'arithmétique se fait en UTC pour éviter les changements d'heure.
 */

export type IsoDate = string;

export const WEEKS_OF_TASKS = 12;
/** Heatmap : 53 colonnes de semaines, comme sur GitHub. */
export const WEEKS_OF_ACTIVITY = 53;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Date locale (AAAA-MM-JJ) d'un instant dans un fuseau. */
export function localDate(instant: Date, timeZone: string): IsoDate {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine (ISO 8601) du jour donné. */
export function startOfWeek(date: IsoDate): IsoDate {
  const weekday = (toUtc(date).getUTCDay() + 6) % 7; // lundi = 0
  return addDays(date, -weekday);
}

/** Les `count` derniers lundis, du plus ancien à la semaine courante. */
export function weekStarts(today: IsoDate, count: number): IsoDate[] {
  const current = startOfWeek(today);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
}

/** Complète les semaines sans tâche terminée avec 0. */
export function fillWeeks(
  weeks: readonly IsoDate[],
  rows: readonly { week: IsoDate; count: number }[],
): { weekStart: IsoDate; count: number }[] {
  const counts = new Map(rows.map((row) => [row.week, row.count]));
  return weeks.map((weekStart) => ({ weekStart, count: counts.get(weekStart) ?? 0 }));
}

/**
 * Série en cours : jours consécutifs avec activité jusqu'à aujourd'hui — ou jusqu'à hier,
 * pour ne pas la remettre à zéro le matin avant la première action. Plus longue série : sur
 * la période fournie.
 */
export function streaks(
  activeDays: ReadonlySet<IsoDate>,
  today: IsoDate,
): {
  current: number;
  longest: number;
} {
  let current = 0;
  let day = activeDays.has(today) ? today : addDays(today, -1);
  while (activeDays.has(day)) {
    current++;
    day = addDays(day, -1);
  }

  let longest = 0;
  for (const start of activeDays) {
    if (activeDays.has(addDays(start, -1))) continue; // pas un début de série
    let length = 0;
    let cursor = start;
    while (activeDays.has(cursor)) {
      length++;
      cursor = addDays(cursor, 1);
    }
    longest = Math.max(longest, length);
  }
  return { current, longest };
}

/** Premier jour affiché par la heatmap : le lundi d'il y a 52 semaines. */
export function activityStart(today: IsoDate): IsoDate {
  return addDays(startOfWeek(today), -7 * (WEEKS_OF_ACTIVITY - 1));
}
