import { currentLanguage, intlLocale } from './language';
import { translate } from './translate';

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

/** Date mise en forme dans la langue courante (formateurs Intl mis en cache par langue). */
export function formatDate(value: Date | string, options: Intl.DateTimeFormatOptions): string {
  const locale = intlLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter.format(typeof value === 'string' ? new Date(value) : value);
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** « il y a 3 jours », « hier », « à l'instant » — ou « 3 days ago », « yesterday », « just now ». */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const locale = intlLocale();
  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormatters.set(locale, formatter);
  }
  const seconds = (new Date(value).getTime() - now.getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return translate('common.justNow');
}

/** Ordre alphabétique de la langue courante (accents compris). */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, currentLanguage());
}
