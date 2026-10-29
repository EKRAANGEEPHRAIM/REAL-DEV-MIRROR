import { Pipe, type PipeTransform } from '@angular/core';
import { formatRelative } from '../../core/i18n/format';

/** « il y a 3 jours », « hier », « à l'instant »… dans la langue courante. */
export const relativeTime = formatRelative;

/** Impur : le texte suit la langue de l'interface, pas seulement la date reçue. */
@Pipe({ name: 'relativeTime', pure: false })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return value ? formatRelative(value) : '';
  }
}
