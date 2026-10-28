import { inject, Injectable } from '@angular/core';
import type { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmDialogService } from '@spartan-ng/helm/dialog';

/**
 * Ouvre la palette (une seule à la fois) ; utilisée par le raccourci et le bouton du shell.
 * Le composant est chargé à la première ouverture : il n'alourdit pas le bundle initial.
 */
@Injectable({ providedIn: 'root' })
export class CommandPalette {
  private readonly dialog = inject(HlmDialogService);
  private ref: BrnDialogRef<void> | null = null;
  private opening = false;

  get isOpen(): boolean {
    return this.ref !== null || this.opening;
  }

  async open(): Promise<void> {
    if (this.isOpen) return;
    this.opening = true;
    try {
      const { CommandPaletteDialog } = await import('./command-palette-dialog');
      this.ref = this.dialog.open<void>(CommandPaletteDialog, {
        contentClass: 'sm:max-w-xl gap-0 overflow-hidden p-0',
        autoFocus: '#palette-input',
      });
      this.ref.closed$.subscribe(() => (this.ref = null));
    } finally {
      this.opening = false;
    }
  }

  toggle(): void {
    if (this.ref) this.ref.close();
    else void this.open();
  }
}
