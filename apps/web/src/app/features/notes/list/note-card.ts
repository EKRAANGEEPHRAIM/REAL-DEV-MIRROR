import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { NoteSummary } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePin, lucidePinOff } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { translate } from '../../../core/i18n/translate';

@Component({
  selector: 'dm-note-card',
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmCardImports, RelativeTimePipe],
  providers: [provideIcons({ lucidePin, lucidePinOff })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @let n = note();
    <article
      hlmCard
      class="hover:border-foreground/20 relative h-full gap-2 p-5 transition-colors"
      [class.border-amber-500]="n.pinned"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="min-w-0 font-medium wrap-break-word">
          <!-- Lien étendu à toute la carte (::after) ; le bouton d'épinglage passe au-dessus -->
          <a
            [routerLink]="['/notes', n.id]"
            class="after:absolute after:inset-0 focus-visible:outline-none"
            >{{ n.title }}</a
          >
        </h3>
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          class="relative z-10 -me-2 -mt-1 shrink-0"
          [class.text-amber-600]="n.pinned"
          [attr.aria-pressed]="n.pinned"
          [attr.aria-label]="
            t(n.pinned ? 'notes.card.unpin' : 'notes.card.pin', { title: n.title })
          "
          (click)="pinToggled.emit(n)"
        >
          <ng-icon [name]="n.pinned ? 'lucidePinOff' : 'lucidePin'" aria-hidden="true" />
        </button>
      </div>

      @if (n.excerpt) {
        <p class="text-muted-foreground line-clamp-3 text-sm">{{ n.excerpt }}</p>
      }

      @if (n.tags.length) {
        <div class="relative z-10 flex flex-wrap gap-1">
          @for (tag of n.tags; track tag.id) {
            <button
              type="button"
              class="hover:bg-muted rounded-full border px-2 py-0.5 text-xs"
              [style.border-color]="tag.color"
              [attr.aria-label]="t('notes.card.filterTag', { tag: tag.name })"
              (click)="tagSelected.emit(tag.name)"
            >
              #{{ tag.name }}
            </button>
          }
        </div>
      }

      <p class="text-muted-foreground mt-auto pt-1 text-xs">
        @if (n.project) {
          {{ n.project.name }} ·
        }
        {{ t('notes.card.updated', { when: (n.updatedAt | relativeTime) }) }}
      </p>
    </article>
  `,
})
export class NoteCard {
  protected readonly t = translate;
  readonly note = input.required<NoteSummary>();
  readonly pinToggled = output<NoteSummary>();
  readonly tagSelected = output<string>();
}
