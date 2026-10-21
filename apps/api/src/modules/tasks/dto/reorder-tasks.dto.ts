import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
} from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/client.js';

export const MAX_COLUMN_SIZE = 200;

/** Colonne du Kanban après un glisser-déposer : son statut et l'ordre complet de ses tâches. */
export class ReorderTasksDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus', example: TaskStatus.IN_PROGRESS })
  @IsEnum(TaskStatus, { message: 'Statut invalide' })
  status: TaskStatus;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: MAX_COLUMN_SIZE,
    description: 'Ids des tâches de la colonne, dans l’ordre d’affichage (la première en haut)',
    example: ['clx0task00002', 'clx0task00001'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'La colonne doit contenir au moins une tâche' })
  @ArrayMaxSize(MAX_COLUMN_SIZE, { message: `${MAX_COLUMN_SIZE} tâches au maximum par colonne` })
  @ArrayUnique({ message: 'Une même tâche est présente plusieurs fois' })
  @IsString({ each: true })
  taskIds: string[];
}
