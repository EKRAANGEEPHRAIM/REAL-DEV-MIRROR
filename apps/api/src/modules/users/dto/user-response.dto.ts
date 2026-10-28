import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../../generated/prisma/client.js';
import {
  LANGUAGES,
  PreferencesResponseDto,
  ProfileLinksResponseDto,
  THEMES,
} from './profile.dto.js';

const LINK_KEYS = ['github', 'linkedin', 'website'] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Colonne JSON `links` -> les trois liens connus, null quand absents ou invalides. */
export function readLinks(value: unknown): ProfileLinksResponseDto {
  const links = asRecord(value);
  const read = (key: (typeof LINK_KEYS)[number]) =>
    typeof links[key] === 'string' ? (links[key] as string) : null;
  return { github: read('github'), linkedin: read('linkedin'), website: read('website') };
}

/** Colonne JSON `preferences` -> valeurs connues, sinon valeurs par défaut (système, français). */
export function readPreferences(value: unknown): PreferencesResponseDto {
  const preferences = asRecord(value);
  const theme = THEMES.find((t) => t === preferences['theme']) ?? 'system';
  const language = LANGUAGES.find((l) => l === preferences['language']) ?? 'fr';
  return { theme, language };
}

/** Représentation publique d'un compte : jamais de hash de mot de passe. */
export class UserResponseDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'ada@devmirror.dev' })
  email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Développeuse Angular et NestJS.' })
  bio: string | null;

  @ApiProperty({ type: ProfileLinksResponseDto })
  links: ProfileLinksResponseDto;

  @ApiProperty({ type: PreferencesResponseDto })
  preferences: PreferencesResponseDto;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: '2026-10-17T09:00:00.000Z' })
  createdAt: Date;

  static fromUser(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      links: readLinks(user.links),
      preferences: readPreferences(user.preferences),
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
