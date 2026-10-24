import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });
/** Jalons de départ : espaces retirés, lignes vides ignorées. */
const cleanTitles = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => item !== '')
    : value;

export const MAX_MILESTONES_PER_GOAL = 30;

export class CreateGoalDto {
  @ApiProperty({ example: 'Décrocher une première mission freelance', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200, { message: 'Le titre doit contenir entre 1 et 200 caractères' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-12-31T22:59:59.999Z',
  })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Date cible invalide (date ISO 8601 attendue)' })
  targetDate?: Date | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description: 'Ids de ses propres projets ; en modification, remplace la liste entière',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: '20 projets au maximum' })
  @ArrayUnique({ message: 'Un même projet est présent plusieurs fois' })
  @IsString({ each: true })
  projectIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_MILESTONES_PER_GOAL,
    description: 'Jalons de départ, dans l’ordre (création uniquement)',
    example: ['Mettre à jour le portfolio', 'Créer un profil Malt', 'Envoyer 10 candidatures'],
  })
  @Transform(cleanTitles)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MILESTONES_PER_GOAL, {
    message: `${MAX_MILESTONES_PER_GOAL} jalons au maximum`,
  })
  @IsString({ each: true })
  @MaxLength(200, { each: true, message: 'Chaque jalon fait 200 caractères au maximum' })
  milestones?: string[];
}

/** Les jalons se gèrent ensuite par /goals/:goalId/milestones. */
export class UpdateGoalDto extends PartialType(OmitType(CreateGoalDto, ['milestones'] as const)) {}
