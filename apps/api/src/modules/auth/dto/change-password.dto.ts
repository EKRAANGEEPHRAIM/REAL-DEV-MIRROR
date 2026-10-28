import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PasswordRules } from './password.rules.js';

export class ChangePasswordDto {
  @ApiProperty({ example: 'AncienMotDePasse2026' })
  @IsString()
  @Length(1, 72, { message: 'Le mot de passe actuel est obligatoire' })
  currentPassword: string;

  @PasswordRules()
  newPassword: string;
}
