import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto.js';

function validate(input: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, input);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

const valid = { name: 'Ada Lovelace', email: 'ada@devmirror.dev', password: 'MotDePasse2026' };

describe('RegisterDto', () => {
  it('accepte des données valides et normalise l’email', () => {
    const { dto, errors } = validate({ ...valid, email: '  Ada@DevMirror.DEV ', name: ' Ada ' });

    expect(errors).toEqual([]);
    expect(dto.email).toBe('ada@devmirror.dev');
    expect(dto.name).toBe('Ada');
  });

  it.each([
    ['trop court', 'abc123'],
    ['sans chiffre', 'motdepasse'],
    ['sans lettre', '12345678'],
    ['plus de 72 caractères', `a1${'x'.repeat(71)}`],
  ])('refuse un mot de passe %s', (_cas, password) => {
    expect(validate({ ...valid, password }).errors).toEqual(['password']);
  });

  it('accepte les lettres accentuées comme lettres', () => {
    expect(validate({ ...valid, password: 'éééééé12' }).errors).toEqual([]);
  });

  it('refuse un email invalide et un nom trop court', () => {
    expect(validate({ ...valid, email: 'pas-un-email', name: 'A' }).errors.sort()).toEqual([
      'email',
      'name',
    ]);
  });
});
