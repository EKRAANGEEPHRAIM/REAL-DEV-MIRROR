import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/** Règles du mot de passe, communes à l'inscription et à la réinitialisation. */
export function PasswordRules() {
  return applyDecorators(
    ApiProperty({
      example: 'MotDePasse2026',
      minLength: 8,
      maxLength: 72,
      description: 'Au moins 8 caractères, dont une lettre et un chiffre',
    }),
    IsString(),
    // bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence.
    Length(8, 72, { message: 'Le mot de passe doit contenir entre 8 et 72 caractères' }),
    Matches(/(?=.*\p{L})(?=.*\d)/u, {
      message: 'Le mot de passe doit contenir au moins une lettre et un chiffre',
    }),
  );
}
