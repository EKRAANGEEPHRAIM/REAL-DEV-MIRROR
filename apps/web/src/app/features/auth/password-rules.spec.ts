import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatchValidator, passwordValidator } from './password-rules';

describe('règles du mot de passe', () => {
  it.each([
    ['MotDePasse2026', null],
    ['éééééé12', null],
    ['abc123', { password: ['length'] }],
    ['motdepasse', { password: ['digit'] }],
    ['12345678', { password: ['letter'] }],
  ])('%s -> %j', (value, expected) => {
    expect(passwordValidator(new FormControl(value))).toEqual(expected);
  });

  it('signale deux mots de passe différents', () => {
    const group = new FormGroup({
      password: new FormControl('MotDePasse2026'),
      confirm: new FormControl('Autre2026'),
    });

    expect(passwordsMatchValidator(group)).toEqual({ mismatch: true });
    group.controls.confirm.setValue('MotDePasse2026');
    expect(passwordsMatchValidator(group)).toBeNull();
  });
});
