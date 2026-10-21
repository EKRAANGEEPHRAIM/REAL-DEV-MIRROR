import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/** Navigation précédent / suivant avec la position courante. */
@Component({
  selector: 'dm-pagination',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Pagination" class="flex items-center justify-between gap-4">
      <p class="text-muted-foreground text-sm" aria-live="polite">
        Page {{ page() }} sur {{ totalPages() }} · {{ total() }}
        {{ total() > 1 ? itemsLabel() : itemLabel() }}
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
          Précédente
        </button>
        <button
          hlmBtn
          variant="outline"
          size="sm"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          Suivante
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
  readonly itemLabel = input('élément');
  readonly itemsLabel = input('éléments');
  readonly pageChange = output<number>();
}
