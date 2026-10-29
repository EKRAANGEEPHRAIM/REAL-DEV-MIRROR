import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RecentNote } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideNotebookPen, lucidePin } from '@ng-icons/lucide';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { translate } from '../../../core/i18n/translate';

/** Les dernières notes modifiées, pour reprendre là où on s'était arrêté. */
@Component({
  selector: 'dm-recent-notes-list',
  imports: [RouterLink, NgIcon, RelativeTimePipe],
  providers: [provideIcons({ lucideNotebookPen, lucidePin })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (notes().length) {
      <ul class="-mx-2 flex flex-col">
        @for (note of notes(); track note.id) {
          <li>
            <a
              [routerLink]="['/notes', note.id]"
              class="hover:bg-muted/50 focus-visible:ring-ring block rounded-md px-2 py-2 outline-none focus-visible:ring-2"
            >
              <span class="flex items-center gap-1.5 text-sm font-medium">
                @if (note.pinned) {
                  <ng-icon
                    name="lucidePin"
                    class="text-muted-foreground shrink-0"
                    [attr.aria-label]="t('dashboard.recentNotes.pinned')"
                  />
                }
                <span class="truncate">{{ note.title }}</span>
              </span>
              @if (note.excerpt) {
                <span class="text-muted-foreground line-clamp-1 text-xs">{{ note.excerpt }}</span>
              }
              <span class="text-muted-foreground text-xs"
                >Modifiée {{ note.updatedAt | relativeTime }}</span
              >
            </a>
          </li>
        }
      </ul>
    } @else {
      <div class="flex flex-col items-center gap-2 py-8 text-center">
        <ng-icon
          name="lucideNotebookPen"
          class="text-muted-foreground text-3xl"
          aria-hidden="true"
        />
        <p class="text-muted-foreground text-sm">{{ t('dashboard.recentNotes.empty') }}</p>
        <a routerLink="/notes" class="text-sm underline underline-offset-2">{{
          t('notes.empty.cta')
        }}</a>
      </div>
    }
  `,
})
export class RecentNotesList {
  protected readonly t = translate;
  readonly notes = input.required<readonly RecentNote[]>();
}
