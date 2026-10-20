import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCircle } from '@ng-icons/lucide';
import { PASSWORD_RULES } from './password-rules';

/** Liste des règles du mot de passe, cochées au fil de la saisie. */
@Component({
  selector: 'dm-password-checklist',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideCircle })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-1 text-sm" [attr.id]="listId()" aria-live="polite">
      @for (rule of rules; track rule.id) {
        @let ok = rule.test(password());
        <li
          class="flex items-center gap-2"
          [class.text-muted-foreground]="!ok"
          [class.text-emerald-600]="ok"
        >
          <ng-icon
            [name]="ok ? 'lucideCheck' : 'lucideCircle'"
            class="text-xs"
            aria-hidden="true"
          />
          {{ rule.label }}
          <span class="sr-only">{{ ok ? '(respectée)' : '(non respectée)' }}</span>
        </li>
      }
    </ul>
  `,
})
export class PasswordChecklist {
  readonly password = input.required<string>();
  readonly listId = input('password-rules');
  protected readonly rules = PASSWORD_RULES;
}
