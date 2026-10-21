import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** Tag normalisé : espaces superflus retirés et minuscules ("  Angular  JS " -> "angular js"). */
export function normalizeTagName(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : value;
}

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export class CreateTagDto {
  @ApiProperty({ example: 'angular', maxLength: 30, description: 'Enregistré en minuscules' })
  @Transform(({ value }: { value: unknown }) => normalizeTagName(value))
  @IsString()
  @Length(1, 30, { message: 'Le nom du tag doit contenir entre 1 et 30 caractères' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '#dd0031' })
  @Transform(emptyToNull)
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur invalide (format #RRGGBB)' })
  color?: string | null;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class TagUsageDto {
  @ApiProperty({ example: 3 })
  projects: number;

  @ApiProperty({ example: 5 })
  notes: number;
}

export class TagResponseDto {
  @ApiProperty({ example: 'clx0tag000001' })
  id: string;

  @ApiProperty({ example: 'angular' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#dd0031' })
  color: string | null;

  @ApiProperty({ type: TagUsageDto, description: 'Nombre de projets et de notes qui l’utilisent' })
  usage: TagUsageDto;
}
