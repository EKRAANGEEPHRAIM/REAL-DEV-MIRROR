import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace', minLength: 2, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Le nom doit contenir entre 2 et 80 caractères' })
  name: string;

  @ApiProperty({ example: 'ada@devmirror.dev' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'MotDePasse2026',
    minLength: 8,
    maxLength: 72,
    description: 'Au moins 8 caractères, dont une lettre et un chiffre',
  })
  @IsString()
  // bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence.
  @Length(8, 72, { message: 'Le mot de passe doit contenir entre 8 et 72 caractères' })
  @Matches(/(?=.*\p{L})(?=.*\d)/u, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre',
  })
  password: string;
}
