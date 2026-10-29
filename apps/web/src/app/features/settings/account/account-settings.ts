import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDatabase,
  lucideDownload,
  lucideLoader2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { filter } from 'rxjs';
import { AccountApi } from '../../../core/account/account.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { apiErrorMessage } from '../../../core/http/api-error';
import { DeleteAccountDialog } from './delete-account-dialog';

/** Export JSON des données et suppression du compte. */
@Component({
  selector: 'dm-account-settings',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideDatabase, lucideDownload, lucideLoader2, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="data-heading" class="rounded-xl border p-5">
      <h2 id="data-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideDatabase" aria-hidden="true" />
        Vos données
      </h2>
      <p class="text-muted-foreground mt-1 text-sm">
        Téléchargez tout ce que vous avez saisi dans DevMirror, dans un fichier JSON lisible :
        profil, projets, tâches, objectifs, notes, tags et activité.
      </p>
      <button hlmBtn variant="outline" class="mt-4" [disabled]="exporting()" (click)="exportData()">
        @if (exporting()) {
          <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
        } @else {
          <ng-icon name="lucideDownload" aria-hidden="true" />
        }
        Exporter mes données
      </button>
    </section>

    <section
      aria-labelledby="danger-heading"
      class="border-destructive/40 mt-6 rounded-xl border p-5"
    >
      <h2
        id="danger-heading"
        class="text-destructive flex items-center gap-2 text-lg font-semibold"
      >
        <ng-icon name="lucideTriangleAlert" aria-hidden="true" />
        Supprimer le compte
      </h2>
      <p class="text-muted-foreground mt-1 text-sm">
        Efface définitivement votre compte et toutes vos données. Votre mot de passe vous sera
        demandé.
      </p>
      <button hlmBtn variant="destructive" class="mt-4" (click)="deleteAccount()">
        Supprimer mon compte…
      </button>
    </section>
  `,
})
export class AccountSettings {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthStore);
  private readonly dialog = inject(HlmDialogService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly exporting = signal(false);

  protected exportData(): void {
    this.exporting.set(true);
    this.api.exportData().subscribe({
      next: ({ blob, fileName }) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Export téléchargé');
      },
      error: (error: unknown) => {
        this.exporting.set(false);
        toast.error(apiErrorMessage(error));
      },
    });
  }

  protected deleteAccount(): void {
    this.dialog
      .open<boolean>(DeleteAccountDialog, { contentClass: 'sm:max-w-md', role: 'alertdialog' })
      .closed$.pipe(filter((deleted) => deleted === true))
      .subscribe(() => {
        // Le compte n'existe plus : la session locale est fermée sans appel à l'API.
        this.auth.clearSession();
        void this.router.navigateByUrl('/login');
        toast.success('Votre compte a été supprimé.');
      });
  }
}
