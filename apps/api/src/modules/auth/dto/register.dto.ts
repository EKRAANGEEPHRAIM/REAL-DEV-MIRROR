import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { PasswordRules } from './password.rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const normalizeEmailInput = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace', minLength: 2, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Le nom doit contenir entre 2 et 80 caractères' })
  name: string;

  @ApiProperty({ example: 'ada@devmirror.dev' })
  @Transform(normalizeEmailInput)
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email: string;

  @PasswordRules()
  password: string;
}
