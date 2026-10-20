import { ChangeDetectionStrategy, Component, inject, input, type OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthStore } from '../../../core/auth/auth.store';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { PasswordChecklist } from '../password-checklist';
import { passwordValidator } from '../password-rules';

type Field = 'name' | 'email' | 'password';

@Component({
  selector: 'dm-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
    FormAlert,
    PasswordChecklist,
  ],
  providers: [provideIcons({ lucideLoader2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle class="text-xl">Créer un compte</h1>
        <p hlmCardDescription>Centralisez vos projets et suivez votre progression.</p>
      </div>

      <form
        hlmCardContent
        class="flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        @if (store.error(); as error) {
          <dm-form-alert>{{ error }}</dm-form-alert>
        }

        <div class="flex flex-col gap-2">
          <label hlmLabel for="name">Nom</label>
          <input
            hlmInput
            id="name"
            autocomplete="name"
            formControlName="name"
            [attr.aria-invalid]="showError('name')"
            aria-describedby="name-error"
          />
          @if (showError('name')) {
            <p id="name-error" class="text-destructive text-sm">Entre 2 et 80 caractères.</p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <label hlmLabel for="email">Email</label>
          <input
            hlmInput
            id="email"
            type="email"
            autocomplete="email"
            formControlName="email"
            [attr.aria-invalid]="showError('email')"
            aria-describedby="email-error"
          />
          @if (showError('email')) {
            <p id="email-error" class="text-destructive text-sm">
              Saisissez une adresse email valide.
            </p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <label hlmLabel for="password">Mot de passe</label>
          <input
            hlmInput
            id="password"
            type="password"
            autocomplete="new-password"
            formControlName="password"
            [attr.aria-invalid]="showError('password')"
            aria-describedby="password-rules"
          />
          <dm-password-checklist [password]="password()" />
        </div>

        <button hlmBtn type="submit" class="mt-2 w-full" [disabled]="store.pending()">
          @if (store.pending()) {
            <ng-icon name="lucideLoader2" class="motion-safe:animate-spin" aria-hidden="true" />
            Création du compte…
          } @else {
            Créer mon compte
          }
        </button>
      </form>

      <p hlmCardFooter class="text-muted-foreground justify-center text-sm">
        Déjà inscrit ?
        <a routerLink="/login" class="text-foreground ms-1 font-medium hover:underline"
          >Se connecter</a
        >
      </p>
    </section>
  `,
})
export class RegisterPage implements OnInit {
  protected readonly store = inject(AuthStore);
  readonly returnUrl = input<string | undefined>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', passwordValidator],
  });
  protected readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  ngOnInit(): void {
    this.store.clearError();
  }

  protected showError(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    this.store.register({
      credentials: { name: name.trim(), email, password },
      returnUrl: this.returnUrl(),
    });
  }
}
