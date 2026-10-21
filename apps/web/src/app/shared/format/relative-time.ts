import { Pipe, type PipeTransform } from '@angular/core';

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « il y a 3 jours », « hier », « à l'instant »… */
export function relativeTime(date: string | Date, now: Date = new Date()): string {
  const seconds = (new Date(date).getTime() - now.getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}

@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return value ? relativeTime(value) : '';
  }
}
