import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { ACCOUNT_NOT_FOUND } from './users.service.js';

/** Version du format d'export : à incrémenter si la structure change. */
export const EXPORT_VERSION = 1;

/**
 * Export complet des données d'un utilisateur (droit à la portabilité) : profil, projets,
 * tâches, objectifs, notes, tags et activité. Jamais de secret : ni hash de mot de passe,
 * ni jetons de session.
 */
@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string) {
    const where = { userId };
    const [user, projects, tasks, goals, notes, tags, activity] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: { tags: { select: { name: true } } },
      }),
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          subtasks: {
            select: { title: true, done: true, position: true },
            orderBy: { position: 'asc' },
          },
        },
      }),
      this.prisma.goal.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          milestones: {
            select: { title: true, done: true, position: true },
            orderBy: { position: 'asc' },
          },
          projects: { select: { id: true } },
        },
      }),
      this.prisma.note.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: { tags: { select: { name: true } } },
      }),
      this.prisma.tag.findMany({ where, orderBy: { name: 'asc' } }),
      this.prisma.activity.findMany({ where, orderBy: { createdAt: 'asc' } }),
    ]);
    if (!user) throw new NotFoundException(ACCOUNT_NOT_FOUND);

    return {
      format: 'devmirror-export',
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      profile: UserResponseDto.fromUser(user),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        techStack: p.techStack,
        repoUrl: p.repoUrl,
        demoUrl: p.demoUrl,
        color: p.color,
        tags: p.tags.map((t) => t.name),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        projectId: t.projectId,
        subtasks: t.subtasks,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        targetDate: g.targetDate,
        milestones: g.milestones,
        projectIds: g.projects.map((p) => p.id),
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        projectId: n.projectId,
        tags: n.tags.map((t) => t.name),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      tags: tags.map((t) => ({ name: t.name, color: t.color })),
      activity: activity.map((a) => ({
        type: a.type,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
    };
  }
}

/** Nom du fichier téléchargé : devmirror-export-AAAA-MM-JJ.json */
export function exportFileName(now: Date = new Date()): string {
  return `devmirror-export-${now.toISOString().slice(0, 10)}.json`;
}
