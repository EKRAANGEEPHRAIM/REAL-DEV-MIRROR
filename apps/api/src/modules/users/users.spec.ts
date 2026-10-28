import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { validateEnv } from '../../config/env.validation.js';
import { detectImageType } from './avatar-file.js';
import { AVATAR_STORAGE_DISABLED, AvatarStorage } from './avatar-storage.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
import { readLinks, readPreferences } from './dto/user-response.dto.js';
import { mergeLinks, mergePreferences } from './users.service.js';

const bytes = (...values: number[]) => Buffer.from(values);
const ascii = (text: string) => Buffer.from(text, 'latin1');

describe('detectImageType', () => {
  it('reconnaît JPEG, PNG, WebP et GIF par leurs premiers octets', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png');
    expect(
      detectImageType(Buffer.concat([ascii('RIFF'), bytes(0, 0, 0, 0), ascii('WEBPVP8 ')])),
    ).toBe('webp');
    expect(detectImageType(ascii('GIF89a…'))).toBe('gif');
  });

  it('refuse un fichier déguisé (texte, SVG, PDF) quel que soit son nom', () => {
    expect(detectImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageType(ascii('%PDF-1.7'))).toBeNull();
    expect(detectImageType(ascii('RIFF....AVI '))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});

describe('profil', () => {
  const errors = (plain: object): string[] =>
    validateSync(plainToInstance(UpdateProfileDto, plain)).flatMap(function flatten(
      error: ValidationError,
    ): string[] {
      return [
        ...Object.values(error.constraints ?? {}),
        ...(error.children ?? []).flatMap(flatten),
      ];
    });

  it('valide nom, bio, liens et préférences', () => {
    expect(errors({ name: 'Ada', bio: '', links: { github: 'https://github.com/ada' } })).toEqual(
      [],
    );
    expect(errors({ name: '   ' })).toEqual(['Le nom doit contenir entre 1 et 80 caractères']);
    expect(errors({ links: { github: 'https://gitlab.com/ada' } })).toEqual([
      'Le lien GitHub doit pointer vers github.com',
    ]);
    expect(errors({ links: { website: 'javascript:alert(1)' } })).toEqual([
      'Lien du site invalide (http ou https)',
    ]);
    expect(errors({ preferences: { theme: 'neon' } })).toEqual([
      'Thème invalide (light, dark ou system)',
    ]);
  });

  it('chaîne vide -> null pour effacer la bio ou un lien', () => {
    const dto = plainToInstance(UpdateProfileDto, { bio: '  ', links: { linkedin: '' } });
    expect(dto.bio).toBeNull();
    expect(dto.links?.linkedin).toBeNull();
  });

  it('lit les colonnes JSON avec des valeurs par défaut sûres', () => {
    expect(readLinks({ github: 'https://github.com/ada', autre: 'x', website: 42 })).toEqual({
      github: 'https://github.com/ada',
      linkedin: null,
      website: null,
    });
    expect(readLinks(null)).toEqual({ github: null, linkedin: null, website: null });
    expect(readPreferences({ theme: 'dark', language: 'de' })).toEqual({
      theme: 'dark',
      language: 'fr',
    });
  });

  it('fusionne : un champ absent est gardé, null efface', () => {
    const stored = { github: 'https://github.com/ada', website: 'https://ada.dev' };
    expect(mergeLinks(stored, { linkedin: 'https://linkedin.com/in/ada', website: null })).toEqual({
      github: 'https://github.com/ada',
      linkedin: 'https://linkedin.com/in/ada',
      website: null,
    });
    expect(mergePreferences({ theme: 'dark', language: 'fr' }, { language: 'en' })).toEqual({
      theme: 'dark',
      language: 'en',
    });
  });
});

describe('stockage des avatars', () => {
  const config = (url?: string) =>
    ({ get: () => url }) as unknown as ConfigService<EnvironmentVariables, true>;

  it('sans CLOUDINARY_URL : désactivé, 503 explicite', async () => {
    const storage = new AvatarStorage(config(undefined));
    expect(storage.enabled).toBe(false);
    await expect(storage.upload('user-1', Buffer.from(''))).rejects.toThrow(
      new ServiceUnavailableException(AVATAR_STORAGE_DISABLED),
    );
    await expect(storage.remove('user-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('valide le format de CLOUDINARY_URL au démarrage', () => {
    const base = {
      DATABASE_URL: 'postgresql://u:p@h/db',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
    };
    expect(() =>
      validateEnv({ ...base, CLOUDINARY_URL: 'cloudinary://123:abc@devmirror' }),
    ).not.toThrow();
    expect(() =>
      validateEnv({ ...base, CLOUDINARY_URL: '"cloudinary://123:abc@devmirror"' }),
    ).not.toThrow();
    expect(() => validateEnv({ ...base, CLOUDINARY_URL: 'https://cloudinary.com' })).toThrow(
      /CLOUDINARY_URL/,
    );
  });
});
