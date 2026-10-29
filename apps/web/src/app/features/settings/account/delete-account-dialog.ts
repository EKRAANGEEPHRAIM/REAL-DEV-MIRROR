import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2 } from '@ng-icons/lucide';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AccountApi } from '../../../core/account/account.api';
import { apiErrorMessage } from '../../../core/http/api-error';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { translate } from '../../../core/i18n/translate';

/** Confirmation de la suppression du compte : le mot de passe est exigé. Ferme avec true si supprimé. */
@Component({
  selector: 'dm-delete-account-dialog',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
  ],
  providers: [provideIcons({ lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog-header>
      <h2 hlmDialogTitle>{{ t('settings.delete.dialogTitle') }}</h2>
      <p hlmDialogDescription>
        {{ t('settings.delete.dialogText') }}
      </p>
    </hlm-dialog-header>
    <form class="mt-2 flex flex-col gap-4" (submit)="$event.preventDefault(); confirm()">
      @if (error(); as message) {
        <dm-form-alert>{{ message }}</dm-form-alert>
      }
      <div class="flex flex-col gap-2">
        <label hlmLabel for="delete-password">{{ t('settings.delete.password') }}</label>
        <input
          hlmInput
          id="delete-password"
          type="password"
          autocomplete="current-password"
          [value]="password()"
          (input)="password.set($any($event.target).value)"
        />
      </div>
      <hlm-dialog-footer>
        <button hlmBtn type="button" variant="outline" (click)="ref.close(false)">
          {{ t('common.cancel') }}
        </button>
        <button hlmBtn type="submit" variant="destructive" [disabled]="!password() || pending()">
          @if (pending()) {
            <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
          }
          {{ t('settings.delete.confirm') }}
        </button>
      </hlm-dialog-footer>
    </form>
  `,
})
export class DeleteAccountDialog {
  protected readonly t = translate;
  protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
  private readonly api = inject(AccountApi);

  protected readonly password = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    if (!this.password() || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    this.api.deleteAccount(this.password()).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
