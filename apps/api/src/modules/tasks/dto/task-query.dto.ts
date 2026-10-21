import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Priority, TaskStatus } from '../../../generated/prisma/client.js';

export const TASK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'priority',
  'position',
  'title',
] as const;

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tâches d’un projet' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Uniquement les tâches sans projet', default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  withoutProject?: boolean;

  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Statut invalide' })
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority, enumName: 'Priority' })
  @IsOptional()
  @IsEnum(Priority, { message: 'Priorité invalide' })
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Recherche dans le titre', example: 'tests' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Échéance à partir de (incluse) ; bornes calculées par le client dans son fuseau',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'dueFrom invalide (date ISO 8601 attendue)' })
  dueFrom?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Échéance avant (exclue)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'dueTo invalide (date ISO 8601 attendue)' })
  dueTo?: Date;

  @ApiPropertyOptional({ description: 'Échéance passée et tâche non terminée', default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Uniquement les tâches sans échéance', default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  noDueDate?: boolean;

  @ApiPropertyOptional({
    description: `Tri : ${TASK_SORT_FIELDS.join(', ')} suivi de :asc ou :desc (priority:desc = urgentes d’abord)`,
    example: 'dueDate:asc',
    default: 'createdAt:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
