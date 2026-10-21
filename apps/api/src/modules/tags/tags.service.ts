import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateTagDto, TagResponseDto, UpdateTagDto } from './dto/tag.dto.js';

export const TAG_NOT_FOUND = 'Tag introuvable';
export const TAG_NAME_TAKEN = 'Un tag porte déjà ce nom';
export const UNKNOWN_TAGS = 'Un ou plusieurs tags sont introuvables';

/** Nombre maximal de tags par utilisateur (garde-fou contre la création en masse). */
export const MAX_TAGS_PER_USER = 200;

const tagSelect = {
  id: true,
  name: true,
  color: true,
  _count: { select: { projects: true, notes: true } },
} satisfies Prisma.TagSelect;

type TagWithCounts = Prisma.TagGetPayload<{ select: typeof tagSelect }>;

function toResponse(tag: TagWithCounts): TagResponseDto {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    usage: { projects: tag._count.projects, notes: tag._count.notes },
  };
}

function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

/** Tags de l'utilisateur connecté ; les noms sont uniques par utilisateur (contrainte en base). */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<TagResponseDto[]> {
    const tags = await this.prisma.tag.findMany({
      where: { userId },
      select: tagSelect,
      orderBy: { name: 'asc' },
    });
    return tags.map(toResponse);
  }

  async create(userId: string, dto: CreateTagDto): Promise<TagResponseDto> {
    if ((await this.prisma.tag.count({ where: { userId } })) >= MAX_TAGS_PER_USER) {
      throw new BadRequestException(`${MAX_TAGS_PER_USER} tags au maximum`);
    }
    try {
      const tag = await this.prisma.tag.create({
        data: { userId, name: dto.name, color: dto.color },
        select: tagSelect,
      });
      return toResponse(tag);
    } catch (error) {
      if (prismaCode(error) === 'P2002') throw new ConflictException(TAG_NAME_TAKEN);
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateTagDto): Promise<TagResponseDto> {
    try {
      const tag = await this.prisma.tag.update({
        where: { id, userId },
        data: { name: dto.name, color: dto.color },
        select: tagSelect,
      });
      return toResponse(tag);
    } catch (error) {
      const code = prismaCode(error);
      if (code === 'P2025') throw new NotFoundException(TAG_NOT_FOUND);
      if (code === 'P2002') throw new ConflictException(TAG_NAME_TAKEN);
      throw error;
    }
  }

  /** Supprime le tag ; il est retiré automatiquement des projets et notes qui l'utilisaient. */
  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.prisma.tag.delete({ where: { id, userId } });
    } catch (error) {
      if (prismaCode(error) === 'P2025') throw new NotFoundException(TAG_NOT_FOUND);
      throw error;
    }
  }

  /**
   * Vérifie que tous les tags appartiennent à l'utilisateur avant de les attacher à un projet
   * ou une note : sans ce contrôle, connaître l'id d'un tag suffirait à l'utiliser.
   */
  async assertOwned(userId: string, tagIds: readonly string[]): Promise<void> {
    if (tagIds.length === 0) return;
    const owned = await this.prisma.tag.count({ where: { userId, id: { in: [...tagIds] } } });
    if (owned !== new Set(tagIds).size) throw new BadRequestException(UNKNOWN_TAGS);
  }
}
