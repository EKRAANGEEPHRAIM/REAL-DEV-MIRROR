import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck } from '@ng-icons/lucide';

/** Message de formulaire (erreur ou succès), annoncé aux lecteurs d'écran. */
@Component({
  selector: 'dm-form-alert',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideCircleCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p
      [attr.role]="variant() === 'error' ? 'alert' : 'status'"
      class="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
      [class]="tone()"
    >
      <ng-icon
        [name]="variant() === 'error' ? 'lucideCircleAlert' : 'lucideCircleCheck'"
        class="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span><ng-content /></span>
    </p>
  `,
})
export class FormAlert {
  readonly variant = input<'error' | 'success'>('error');
  protected readonly tone = computed(() =>
    this.variant() === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  );
}
