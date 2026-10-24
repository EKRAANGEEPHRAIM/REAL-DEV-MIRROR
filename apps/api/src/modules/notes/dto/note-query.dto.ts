import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export const NOTE_SORT_FIELDS = ['updatedAt', 'createdAt', 'title'] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class NoteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Recherche plein texte (français) dans le titre et le contenu ; accepte "expression exacte", -exclu et OR. ' +
      'Sans tri explicite, les résultats sont classés par pertinence.',
    example: 'refresh token',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Notes d’un projet' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Nom d’un tag', example: 'nestjs' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional({ description: 'true : seulement les épinglées ; false : les autres' })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({
    description: `Tri : ${NOTE_SORT_FIELDS.join(', ')} suivi de :asc ou :desc (les notes épinglées restent en tête)`,
    example: 'updatedAt:desc',
    default: 'updatedAt:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
