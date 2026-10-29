import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mêmes règles que l'API (RegisterDto / ResetPasswordDto). */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'auth.rules.length',
    test: (v: string) => v.length >= 8 && v.length <= 72,
  },
  { id: 'letter', label: 'auth.rules.letter', test: (v: string) => /\p{L}/u.test(v) },
  { id: 'digit', label: 'auth.rules.digit', test: (v: string) => /\d/.test(v) },
] as const;

export const passwordValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value : '';
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);
  return failed.length ? { password: failed } : null;
};

/** Validateur de groupe : `confirm` doit être identique à `password`. */
export const passwordsMatchValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };
