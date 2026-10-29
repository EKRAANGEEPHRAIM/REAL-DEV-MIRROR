import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { type TranslationKey, translate } from '../../../core/i18n/translate';

/** Palette proposée ; null = pas de couleur. */
export const TAG_COLORS: readonly (string | null)[] = [
  null,
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const COLOR_NAMES: Record<string, TranslationKey> = {
  '#ef4444': 'settings.colors.red',
  '#f97316': 'settings.colors.orange',
  '#eab308': 'settings.colors.yellow',
  '#22c55e': 'settings.colors.green',
  '#06b6d4': 'settings.colors.cyan',
  '#3b82f6': 'settings.colors.blue',
  '#8b5cf6': 'settings.colors.violet',
  '#ec4899': 'settings.colors.pink',
};

/** Pastilles de couleur, groupe de boutons radio accessible. */
@Component({
  selector: 'dm-tag-color-picker',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-1.5" role="radiogroup" [attr.aria-label]="label()">
      @for (color of colors; track color) {
        <button
          type="button"
          role="radio"
          class="focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-full border outline-none focus-visible:ring-2"
          [class.border-dashed]="!color"
          [style.background-color]="color"
          [attr.aria-checked]="value() === color"
          [attr.aria-label]="color ? colorName(color) : t('settings.colors.none')"
          (click)="changed.emit(color)"
        >
          @if (value() === color) {
            <ng-icon
              name="lucideCheck"
              class="text-xs"
              [class.text-white]="!!color"
              aria-hidden="true"
            />
          }
        </button>
      }
    </div>
  `,
})
export class TagColorPicker {
  protected readonly t = translate;
  readonly value = input<string | null>(null);
  /** Nom accessible du groupe, déjà traduit. */
  readonly label = input.required<string>();
  readonly changed = output<string | null>();

  protected readonly colors = TAG_COLORS;

  protected colorName(color: string): string {
    const key = COLOR_NAMES[color];
    return key ? translate(key) : color;
  }
}
