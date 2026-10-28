import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const THEMES = ['light', 'dark', 'system'] as const;
export const LANGUAGES = ['fr', 'en'] as const;
export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Chaîne vide -> null : effacer un champ facultatif depuis un formulaire. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });
const urlOptions = { protocols: ['http', 'https'], require_protocol: true };

export class ProfileLinksDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://github.com/ada' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(urlOptions, { message: 'Lien GitHub invalide (http ou https)' })
  @Matches(/^https?:\/\/(www\.)?github\.com\//i, {
    message: 'Le lien GitHub doit pointer vers github.com',
  })
  @MaxLength(300)
  github?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://www.linkedin.com/in/ada' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(urlOptions, { message: 'Lien LinkedIn invalide (http ou https)' })
  @Matches(/^https?:\/\/([\w-]+\.)?linkedin\.com\//i, {
    message: 'Le lien LinkedIn doit pointer vers linkedin.com',
  })
  @MaxLength(300)
  linkedin?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://ada.dev' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(urlOptions, { message: 'Lien du site invalide (http ou https)' })
  @MaxLength(300)
  website?: string | null;
}

export class PreferencesDto {
  @ApiPropertyOptional({ enum: THEMES, example: 'system' })
  @IsOptional()
  @IsIn(THEMES, { message: 'Thème invalide (light, dark ou system)' })
  theme?: Theme;

  @ApiPropertyOptional({ enum: LANGUAGES, example: 'fr' })
  @IsOptional()
  @IsIn(LANGUAGES, { message: 'Langue invalide (fr ou en)' })
  language?: Language;
}

/** Modification partielle du profil ; liens et préférences fusionnés avec l'existant. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ada Lovelace', maxLength: 80 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80, { message: 'Le nom doit contenir entre 1 et 80 caractères' })
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La bio ne peut pas dépasser 500 caractères' })
  bio?: string | null;

  @ApiPropertyOptional({ type: ProfileLinksDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProfileLinksDto)
  links?: ProfileLinksDto;

  @ApiPropertyOptional({ type: PreferencesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}

export class ProfileLinksResponseDto {
  @ApiProperty({ type: String, nullable: true })
  github: string | null;

  @ApiProperty({ type: String, nullable: true })
  linkedin: string | null;

  @ApiProperty({ type: String, nullable: true })
  website: string | null;
}

export class PreferencesResponseDto {
  @ApiProperty({ enum: THEMES, example: 'system' })
  theme: Theme;

  @ApiProperty({ enum: LANGUAGES, example: 'fr' })
  language: Language;
}
