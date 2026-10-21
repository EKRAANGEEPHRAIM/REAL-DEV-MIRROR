import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { Priority, TaskStatus } from '../../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });

export class CreateTaskDto {
  @ApiProperty({ example: 'Écrire les tests du module tasks', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200, { message: 'Le titre doit contenir entre 1 et 200 caractères' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La description ne peut pas dépasser 5000 caractères' })
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus', default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Statut invalide' })
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority, enumName: 'Priority', default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority, { message: 'Priorité invalide' })
  priority?: Priority;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-30T17:00:00.000Z',
  })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Échéance invalide (date ISO 8601 attendue)' })
  dueDate?: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Projet de rattachement (un de ses projets) ; null = tâche sans projet',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Position dans la colonne du Kanban ; par défaut en bas de la colonne',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

/** Mise à jour partielle ; changer de statut sans position place la tâche en bas de la colonne. */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
