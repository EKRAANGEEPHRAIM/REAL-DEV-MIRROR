import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'MotDePasse2026', description: 'Mot de passe actuel, pour confirmer' })
  @IsString()
  @Length(1, 72, { message: 'Le mot de passe est obligatoire pour supprimer le compte' })
  password: string;
}
