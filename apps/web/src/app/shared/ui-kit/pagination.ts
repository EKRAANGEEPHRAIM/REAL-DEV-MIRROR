import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { type TranslationKey, translate } from '../../core/i18n/translate';

/** Navigation précédent / suivant avec la position courante. */
@Component({
  selector: 'dm-pagination',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="t('common.pagination')" class="flex items-center justify-between gap-4">
      <p class="text-muted-foreground text-sm" aria-live="polite">
        {{ t('common.pageOf', { page: page(), totalPages: totalPages() }) }} ·
        {{ t(unit(), { count: total() }) }}
      </p>
      <div class="flex gap-2">
        <button
          hlmBtn
          variant="outline"
          size="sm"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          <ng-icon name="lucideChevronLeft" aria-hidden="true" />
          {{ t('common.previous') }}
        </button>
        <button
          hlmBtn
          variant="outline"
          size="sm"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          {{ t('common.next') }}
          <ng-icon name="lucideChevronRight" aria-hidden="true" />
        </button>
      </div>
    </nav>
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  /** Clé « {count} projet|{count} projets » : nombre d'éléments accordé. */
  readonly unit = input.required<TranslationKey>();
  readonly pageChange = output<number>();
  protected readonly t = translate;
}
