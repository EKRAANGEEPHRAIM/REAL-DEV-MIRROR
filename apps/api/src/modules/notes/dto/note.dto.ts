import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Assez pour une longue note Markdown, sous la limite de 100 ko du corps JSON. */
export const MAX_NOTE_CONTENT = 30_000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export class CreateNoteDto {
  @ApiProperty({ example: 'Pièges du rafraîchissement JWT', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200, { message: 'Le titre doit contenir entre 1 et 200 caractères' })
  title: string;

  @ApiPropertyOptional({
    description: 'Contenu Markdown (non modifié : espaces et retours à la ligne conservés)',
    maxLength: MAX_NOTE_CONTENT,
    default: '',
    example: '## Rotation\n\nUn refresh token ne sert **qu’une fois**.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_CONTENT, {
    message: `Le contenu ne peut pas dépasser ${MAX_NOTE_CONTENT} caractères`,
  })
  content?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Projet de rattachement (un de ses projets) ; null = note libre',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description: 'Ids de ses propres tags ; en modification, remplace la liste entière',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: '20 tags au maximum' })
  @ArrayUnique({ message: 'Un même tag est présent plusieurs fois' })
  @IsString({ each: true })
  tagIds?: string[];
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
