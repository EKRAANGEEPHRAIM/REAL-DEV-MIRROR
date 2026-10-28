import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { noteExcerpt } from '../notes/note-excerpt.js';
import { NotesService } from '../notes/notes.service.js';
import type {
  NoteHitDto,
  ProjectHitDto,
  SearchQueryDto,
  SearchResultsDto,
  TaskHitDto,
} from './dto/search.dto.js';

/** Candidats lus par catégorie avant classement : de quoi trier au-delà de `limit`. */
const CANDIDATES = 50;

/**
 * Pertinence d'un libellé : titre identique, puis qui commence par la recherche, puis un mot
 * qui commence par elle, puis simple présence (dans le titre ou ailleurs).
 */
export function titleScore(label: string, q: string): number {
  const text = label.toLocaleLowerCase('fr');
  const needle = q.toLocaleLowerCase('fr');
  if (text === needle) return 4;
  if (text.startsWith(needle)) return 3;
  if (text.split(/[\s\-_/.]+/).some((word) => word.startsWith(needle))) return 2;
  if (text.includes(needle)) return 1;
  return 0;
}

function rank<T extends { updatedAt: Date }>(
  items: T[],
  label: (item: T) => string,
  q: string,
  limit: number,
): T[] {
  return items
    .map((item) => ({ item, score: titleScore(label(item), q) }))
    .sort((a, b) => b.score - a.score || b.item.updatedAt.getTime() - a.item.updatedAt.getTime())
    .slice(0, limit)
    .map(({ item }) => item);
}

/** Recherche globale (palette Ctrl+K) : projets, tâches et notes de l'utilisateur. */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notes: NotesService,
  ) {}

  async search(userId: string, { q, limit }: SearchQueryDto): Promise<SearchResultsDto> {
    const [projects, tasks, notes] = await Promise.all([
      this.searchProjects(userId, q, limit),
      this.searchTasks(userId, q, limit),
      this.searchNotes(userId, q, limit),
    ]);
    return { q, projects, tasks, notes };
  }

  private async searchProjects(userId: string, q: string, limit: number): Promise<ProjectHitDto[]> {
    const contains = { contains: q, mode: 'insensitive' } as const;
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
        OR: [{ name: contains }, { description: contains }, { techStack: { has: q } }],
      },
      select: { id: true, name: true, color: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATES,
    });
    return rank(projects, (p) => p.name, q, limit).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
    }));
  }

  private async searchTasks(userId: string, q: string, limit: number): Promise<TaskHitDto[]> {
    const contains = { contains: q, mode: 'insensitive' } as const;
    const tasks = await this.prisma.task.findMany({
      where: { userId, OR: [{ title: contains }, { description: contains }] },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATES,
    });
    return rank(tasks, (t) => t.title, q, limit).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      project: t.project,
    }));
  }

  /** Notes : la recherche plein texte du module notes donne déjà l'ordre de pertinence. */
  private async searchNotes(userId: string, q: string, limit: number): Promise<NoteHitDto[]> {
    const ranked = await this.notes.search(userId, q);
    const ids = [...ranked.keys()].slice(0, limit);
    if (ids.length === 0) return [];

    const notes = await this.prisma.note.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, title: true, content: true, pinned: true },
    });
    const byId = new Map(notes.map((note) => [note.id, note]));
    return ids.flatMap((id) => {
      const note = byId.get(id);
      return note
        ? [
            {
              id: note.id,
              title: note.title,
              excerpt: noteExcerpt(note.content, 120),
              pinned: note.pinned,
            },
          ]
        : [];
    });
  }
}
