import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ProjectStatus } from '../../../generated/prisma/client.js';

export const PROJECT_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'status'] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ProjectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Statut invalide' })
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Recherche dans le nom et la description',
    example: 'portfolio',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Nom d’un tag', example: 'angular' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional({
    description: 'Inclure les projets archivés (masqués par défaut, sauf filtre status=ARCHIVED)',
    default: false,
  })
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: `Tri : ${PROJECT_SORT_FIELDS.join(', ')} suivi de :asc ou :desc`,
    example: 'updatedAt:desc',
    default: 'updatedAt:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
