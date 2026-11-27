import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logo DevMirror : une invite de terminal « >_ » dans un carré sombre (identique dans les deux
 * thèmes), suivie du nom. Pur gabarit, sans bibliothèque d'icônes : il peut entrer dans le
 * bundle initial des pages publiques sans l'alourdir.
 */
@Component({
  selector: 'dm-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2 font-bold tracking-tight' },
  template: `
    <span
      class="inline-grid size-7 place-items-center rounded-[3px] bg-[#0f0d0a] text-[0.8rem] leading-none text-[#ffb000]"
      aria-hidden="true"
      >&gt;_</span
    >
    @if (withName()) {
      <span>Dev<span class="text-primary">Mirror</span></span>
    }
  `,
})
export class Logo {
  readonly withName = input(true);
}
