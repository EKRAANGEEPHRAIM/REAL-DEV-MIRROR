import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PreferencesDto, ProfileLinksDto, UpdateProfileDto } from './dto/profile.dto.js';
import { readLinks, readPreferences } from './dto/user-response.dto.js';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

/** Accès aux comptes ; les emails sont toujours comparés normalisés (minuscules, sans espaces). */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: normalizeEmail(data.email), name: data.name.trim() },
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { emailVerified: true } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * Modification partielle : seuls les champs présents changent. Liens et préférences sont
   * fusionnés avec les valeurs existantes (changer la langue ne remet pas le thème à zéro).
   */
  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { links: true, preferences: true },
    });
    if (!current) throw new NotFoundException(ACCOUNT_NOT_FOUND);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        bio: dto.bio,
        ...(dto.links && { links: mergeLinks(current.links, dto.links) }),
        ...(dto.preferences && {
          preferences: mergePreferences(current.preferences, dto.preferences),
        }),
      },
    });
  }

  async setAvatar(id: string, avatarUrl: string | null): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { avatarUrl } });
  }

  /** Supprime le compte ; projets, tâches, objectifs, notes, tags, activité et sessions suivent (cascade). */
  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}

export const ACCOUNT_NOT_FOUND = 'Compte introuvable';

/** Un champ absent du corps (undefined) garde sa valeur ; null l'efface explicitement. */
export function mergeLinks(stored: unknown, changes: ProfileLinksDto) {
  const current = readLinks(stored);
  return {
    github: changes.github === undefined ? current.github : changes.github,
    linkedin: changes.linkedin === undefined ? current.linkedin : changes.linkedin,
    website: changes.website === undefined ? current.website : changes.website,
  };
}

export function mergePreferences(stored: unknown, changes: PreferencesDto) {
  const current = readPreferences(stored);
  return {
    theme: changes.theme ?? current.theme,
    language: changes.language ?? current.language,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
