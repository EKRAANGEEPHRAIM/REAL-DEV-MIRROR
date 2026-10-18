import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { PasswordRules } from './password.rules.js';
import { normalizeEmailInput } from './register.dto.js';

const tokenProperty = ApiProperty({
  description: 'Jeton reçu dans le lien de l’email',
  example: 'q5Yw0bJt8vZr3mN1xKc7Ld2Pf9Hs4Ug6Ae0Wi3Ty5Ro',
});
const tokenMessage = { message: 'Lien invalide ou expiré' };

export class VerifyEmailDto {
  @tokenProperty
  @IsString(tokenMessage)
  @Length(43, 43, tokenMessage)
  token: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ada@devmirror.dev' })
  @Transform(normalizeEmailInput)
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @tokenProperty
  @IsString(tokenMessage)
  @Length(43, 43, tokenMessage)
  token: string;

  @PasswordRules()
  password: string;
}
