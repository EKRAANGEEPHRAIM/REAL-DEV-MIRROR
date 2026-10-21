import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '../../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Chaîne vide -> null : permet d'effacer un champ facultatif depuis un formulaire. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });
/** Technologies : espaces retirés, vides et doublons (insensibles à la casse) supprimés. */
const cleanTechStack = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => {
      if (typeof item !== 'string') return true;
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const urlOptions = { protocols: ['http', 'https'], require_protocol: true };

export class CreateProjectDto {
  @ApiProperty({ example: 'DevMirror', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120, { message: 'Le nom doit contenir entre 1 et 120 caractères' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000, example: 'Portfolio SaaS' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
  description?: string | null;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    default: ProjectStatus.IDEA,
  })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Statut invalide' })
  status?: ProjectStatus;

  @ApiPropertyOptional({ type: [String], maxItems: 20, example: ['Angular', 'NestJS', 'Prisma'] })
  @Transform(cleanTechStack)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: '20 technologies au maximum' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Chaque technologie fait 40 caractères au maximum' })
  techStack?: string[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://github.com/ada/devmirror',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(urlOptions, { message: 'Lien du dépôt invalide (http ou https)' })
  @MaxLength(500)
  repoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://devmirror.vercel.app' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(urlOptions, { message: 'Lien de démo invalide (http ou https)' })
  @MaxLength(500)
  demoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '#6366f1' })
  @Transform(emptyToNull)
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur invalide (format #RRGGBB)' })
  color?: string | null;
}
