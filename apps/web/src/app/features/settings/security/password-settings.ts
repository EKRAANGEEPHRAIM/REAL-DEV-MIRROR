import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { map } from 'rxjs';
import { AccountApi } from '../../../core/account/account.api';
import { apiErrorMessage } from '../../../core/http/api-error';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { PasswordChecklist } from '../../auth/password-checklist';
import { passwordsMatchValidator, passwordValidator } from '../../auth/password-rules';

@Component({
  selector: 'dm-password-settings',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
    PasswordChecklist,
  ],
  providers: [provideIcons({ lucideKeyRound, lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="password-heading" class="rounded-xl border p-5">
      <h2 id="password-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideKeyRound" aria-hidden="true" />
        Mot de passe
      </h2>
      <p class="text-muted-foreground mt-1 text-sm">
        Vos autres appareils seront déconnectés ; celui-ci reste connecté.
      </p>

      <form
        class="mt-4 flex max-w-md flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        @if (error(); as message) {
          <dm-form-alert>{{ message }}</dm-form-alert>
        }
        <div class="flex flex-col gap-2">
          <label hlmLabel for="current-password">Mot de passe actuel</label>
          <input
            hlmInput
            id="current-password"
            type="password"
            autocomplete="current-password"
            formControlName="current"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="new-password">Nouveau mot de passe</label>
          <input
            hlmInput
            id="new-password"
            type="password"
            autocomplete="new-password"
            formControlName="password"
            aria-describedby="new-password-rules"
          />
          <dm-password-checklist [password]="newPassword()" listId="new-password-rules" />
        </div>
        <div class="flex flex-col gap-2">
          <label hlmLabel for="confirm-password">Confirmer le nouveau mot de passe</label>
          <input
            hlmInput
            id="confirm-password"
            type="password"
            autocomplete="new-password"
            formControlName="confirm"
            [attr.aria-invalid]="mismatch()"
          />
          @if (mismatch()) {
            <p class="text-destructive text-sm">Les deux mots de passe ne correspondent pas.</p>
          }
        </div>
        <div>
          <button hlmBtn type="submit" [disabled]="saving()">
            @if (saving()) {
              <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            }
            Changer le mot de passe
          </button>
        </div>
      </form>
    </section>
  `,
})
export class PasswordSettings {
  private readonly api = inject(AccountApi);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      current: ['', Validators.required],
      password: ['', passwordValidator],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );
  protected readonly newPassword = toSignal(
    this.form.controls.password.valueChanges.pipe(map((value) => value ?? '')),
    { initialValue: '' },
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected mismatch(): boolean {
    const confirm = this.form.controls.confirm;
    return !!this.form.errors?.['mismatch'] && (confirm.touched || confirm.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        this.form.controls.current.invalid
          ? 'Saisissez votre mot de passe actuel.'
          : 'Le nouveau mot de passe ne respecte pas les règles ou ne correspond pas à la confirmation.',
      );
      return;
    }
    const { current, password } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.changePassword({ currentPassword: current, newPassword: password }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        toast.success('Mot de passe modifié ; vos autres sessions ont été fermées.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
