import { Injectable, NotFoundException } from '@nestjs/common';
import { type Paginated, paginate } from '../../common/dto/paginated-response.dto.js';
import { toSkipTake } from '../../common/dto/pagination-query.dto.js';
import { parseSort } from '../../common/dto/sort.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TagsService } from '../tags/tags.service.js';
import { NOTE_SORT_FIELDS, type NoteQueryDto } from './dto/note-query.dto.js';
import type { NoteResponseDto, NoteSummaryDto } from './dto/note-response.dto.js';
import type { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';
import { noteExcerpt } from './note-excerpt.js';

export const NOTE_NOT_FOUND = 'Note introuvable';

/** Plafond des résultats classés par pertinence (au-delà, affiner la recherche). */
export const MAX_SEARCH_RESULTS = 500;

const noteInclude = {
  project: { select: { id: true, name: true, color: true } },
  tags: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.NoteInclude;

type NoteWithRelations = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

export function toNoteSummary(note: NoteWithRelations): NoteSummaryDto {
  return {
    id: note.id,
    title: note.title,
    excerpt: noteExcerpt(note.content),
    pinned: note.pinned,
    project: note.project,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function toNoteResponse(note: NoteWithRelations): NoteResponseDto {
  const summary = toNoteSummary(note);
  return {
    id: summary.id,
    title: summary.title,
    excerpt: summary.excerpt,
    content: note.content,
    pinned: summary.pinned,
    project: summary.project,
    tags: summary.tags,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

/** `%` et `_` saisis par l'utilisateur sont cherchés tels quels, pas comme jokers. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const toConnect = (ids: readonly string[]) => ids.map((id) => ({ id }));

/** Notes de l'utilisateur connecté : toute requête est filtrée par `userId`. */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly tags: TagsService,
  ) {}

  async findAll(userId: string, query: NoteQueryDto): Promise<Paginated<NoteSummaryDto>> {
    const where: Prisma.NoteWhereInput = { userId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.pinned !== undefined) where.pinned = query.pinned;
    if (query.tag) where.tags = { some: { name: { equals: query.tag, mode: 'insensitive' } } };

    if (query.q) {
      const ranked = await this.search(userId, query.q);
      where.id = { in: [...ranked.keys()] };
      // Sans tri demandé : épinglées d'abord, puis par pertinence.
      if (!query.sort) return this.findByRank(where, ranked, query);
    }

    const sort = parseSort(query.sort, NOTE_SORT_FIELDS, { updatedAt: 'desc' });
    const [notes, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, sort, { id: 'asc' }],
        include: noteInclude,
        ...toSkipTake(query),
      }),
      this.prisma.note.count({ where }),
    ]);
    return paginate(notes.map(toNoteSummary), total, query);
  }

  async findOne(userId: string, id: string): Promise<NoteResponseDto> {
    const note = await this.prisma.note.findFirst({ where: { id, userId }, include: noteInclude });
    if (!note) throw new NotFoundException(NOTE_NOT_FOUND);
    return toNoteResponse(note);
  }

  async create(userId: string, dto: CreateNoteDto): Promise<NoteResponseDto> {
    if (dto.projectId) await this.projects.assertOwned(userId, dto.projectId);
    await this.tags.assertOwned(userId, dto.tagIds ?? []);

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          userId,
          title: dto.title,
          content: dto.content ?? '',
          pinned: dto.pinned,
          projectId: dto.projectId ?? null,
          ...(dto.tagIds?.length ? { tags: { connect: toConnect(dto.tagIds) } } : {}),
        },
        include: noteInclude,
      });
      await tx.activity.create({
        data: { userId, type: 'NOTE_CREATED', entityType: 'NOTE', entityId: created.id },
      });
      return created;
    });
    return toNoteResponse(note);
  }

  async update(userId: string, id: string, dto: UpdateNoteDto): Promise<NoteResponseDto> {
    if (dto.projectId) await this.projects.assertOwned(userId, dto.projectId);
    if (dto.tagIds) await this.tags.assertOwned(userId, dto.tagIds);

    try {
      const note = await this.prisma.note.update({
        where: { id, userId },
        data: {
          title: dto.title,
          content: dto.content,
          pinned: dto.pinned,
          projectId: dto.projectId,
          // `set` remplace la liste ; absente du corps, elle reste inchangée.
          ...(dto.tagIds ? { tags: { set: toConnect(dto.tagIds) } } : {}),
        },
        include: noteInclude,
      });
      return toNoteResponse(note);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(NOTE_NOT_FOUND);
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.note.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException(NOTE_NOT_FOUND);
  }

  /**
   * Recherche plein texte (dictionnaire français : « tests » trouve « test ») complétée par
   * une recherche de sous-chaîne, pour qu'un début de mot (« nest » -> « NestJS ») trouve aussi.
   * Renvoie les ids trouvés, du plus pertinent au moins pertinent.
   */
  async search(userId: string, q: string): Promise<Map<string, number>> {
    const document = Prisma.sql`setweight(to_tsvector('french', "title"), 'A') || setweight(to_tsvector('french', "content"), 'B')`;
    const tsQuery = Prisma.sql`websearch_to_tsquery('french', ${q})`;
    const like = likePattern(q);

    const rows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      SELECT "id",
             ts_rank(${document}, ${tsQuery})
               + CASE WHEN "title" ILIKE ${like} THEN 1 ELSE 0 END AS "rank"
      FROM "Note"
      WHERE "userId" = ${userId}
        AND (${document} @@ ${tsQuery} OR "title" ILIKE ${like} OR "content" ILIKE ${like})
      ORDER BY "rank" DESC, "updatedAt" DESC
      LIMIT ${MAX_SEARCH_RESULTS}`;
    return new Map(rows.map((row) => [row.id, Number(row.rank)]));
  }

  /** Les filtres restent appliqués par Prisma ; l'ordre et la pagination suivent le classement. */
  private async findByRank(
    where: Prisma.NoteWhereInput,
    ranked: Map<string, number>,
    query: NoteQueryDto,
  ): Promise<Paginated<NoteSummaryDto>> {
    const matches = await this.prisma.note.findMany({ where, select: { id: true, pinned: true } });
    const order = matches
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || (ranked.get(b.id) ?? 0) - (ranked.get(a.id) ?? 0),
      )
      .map((note) => note.id);

    const { skip, take } = toSkipTake(query);
    const pageIds = order.slice(skip, skip + take);
    const notes = await this.prisma.note.findMany({
      where: { id: { in: pageIds } },
      include: noteInclude,
    });
    const byId = new Map(notes.map((note) => [note.id, note]));
    const page = pageIds.flatMap((id) => {
      const note = byId.get(id);
      return note ? [toNoteSummary(note)] : [];
    });
    return paginate(page, order.length, query);
  }
}
