import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, HlmDialogService } from '@spartan-ng/helm/dialog';
import { map, type Observable } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  /** Action irréversible : bouton rouge. */
  destructive?: boolean;
}

@Component({
  selector: 'dm-confirm-dialog',
  imports: [HlmButtonImports, HlmDialogImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog-header>
      <h2 hlmDialogTitle>{{ options.title }}</h2>
      <p hlmDialogDescription>{{ options.description }}</p>
    </hlm-dialog-header>
    <hlm-dialog-footer class="mt-4">
      <button hlmBtn variant="outline" (click)="ref.close(false)">Annuler</button>
      <button
        hlmBtn
        [variant]="options.destructive ? 'destructive' : 'default'"
        (click)="ref.close(true)"
      >
        {{ options.confirmLabel ?? 'Confirmer' }}
      </button>
    </hlm-dialog-footer>
  `,
})
export class ConfirmDialog {
  protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  protected readonly options = injectBrnDialogContext<ConfirmOptions>();
}

/** `confirm({ … })` émet true si l'utilisateur confirme, false s'il annule ou ferme. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(HlmDialogService);

  confirm(options: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open<boolean, ConfirmOptions>(ConfirmDialog, {
        context: options,
        contentClass: 'sm:max-w-md',
        role: 'alertdialog',
      })
      .closed$.pipe(map((confirmed) => confirmed === true));
  }
}
