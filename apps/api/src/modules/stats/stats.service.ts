import { Injectable } from '@nestjs/common';
import { ProjectStatus, TaskStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GOAL_ACTIVE, GOAL_COMPLETED } from '../goals/goals.service.js';
import { noteExcerpt } from '../notes/note-excerpt.js';
import type {
  ActivityCalendarDto,
  DueTaskDto,
  RecentNoteDto,
  StatsOverviewDto,
  StatusCountDto,
} from './dto/stats.dto.js';
import {
  activityStart,
  fillWeeks,
  type IsoDate,
  localDate,
  streaks,
  WEEKS_OF_TASKS,
  weekStarts,
} from './stats-calendar.js';

const DAY_MS = 86_400_000;
export const DUE_SOON_DAYS = 7;
export const DUE_SOON_LIMIT = 10;
export const RECENT_NOTES = 5;

/** Statuts dans l'ordre d'affichage du graphique. */
const STATUS_ORDER: readonly ProjectStatus[] = [
  ProjectStatus.IDEA,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.PAUSED,
  ProjectStatus.DONE,
  ProjectStatus.ARCHIVED,
];

export function fillStatuses(
  rows: readonly { status: ProjectStatus; _count: { _all: number } }[],
): StatusCountDto[] {
  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  return STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

/**
 * Statistiques du tableau de bord. Les dates sont stockées en UTC ; les regroupements par
 * semaine et par jour se font dans le fuseau de l'utilisateur, côté SQL.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tout ce qu'affiche le tableau de bord, en une seule réponse. */
  async overview(userId: string, timeZone: string, now = new Date()): Promise<StatsOverviewDto> {
    const today = localDate(now, timeZone);
    const weeks = weekStarts(today, WEEKS_OF_TASKS);
    const notDone = { not: TaskStatus.DONE };

    const [
      weekRows,
      byStatus,
      activeProjects,
      openTasks,
      overdueTasks,
      activeGoals,
      completedGoals,
      notes,
      dueSoon,
      recentNotes,
      activity,
    ] = await Promise.all([
      this.completedPerWeek(userId, timeZone, weeks[0]),
      this.prisma.project.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      this.prisma.project.count({ where: { userId, status: ProjectStatus.IN_PROGRESS } }),
      this.prisma.task.count({ where: { userId, status: notDone } }),
      this.prisma.task.count({ where: { userId, status: notDone, dueDate: { lt: now } } }),
      this.prisma.goal.count({ where: { AND: [{ userId }, GOAL_ACTIVE] } }),
      this.prisma.goal.count({ where: { AND: [{ userId }, GOAL_COMPLETED] } }),
      this.prisma.note.count({ where: { userId } }),
      this.dueSoon(userId, now),
      this.recentNotes(userId),
      this.activity(userId, timeZone, now),
    ]);

    const tasksCompletedPerWeek = fillWeeks(weeks, weekRows);
    const { current, longest } = streaks(new Set(activity.days.map((d) => d.date)), today);

    return {
      timeZone,
      today,
      indicators: {
        activeProjects,
        openTasks,
        tasksCompletedThisWeek: tasksCompletedPerWeek.at(-1)?.count ?? 0,
        overdueTasks,
        activeGoals,
        completedGoals,
        notes,
        currentStreak: current,
        longestStreak: longest,
      },
      tasksCompletedPerWeek,
      projectsByStatus: fillStatuses(byStatus),
      dueSoon,
      recentNotes,
      activity,
    };
  }

  /** Actions par jour sur 53 semaines (heatmap) ; seuls les jours actifs sont renvoyés. */
  async activity(userId: string, timeZone: string, now = new Date()): Promise<ActivityCalendarDto> {
    const to = localDate(now, timeZone);
    const from = activityStart(to);
    const days = await this.prisma.$queryRaw<{ date: IsoDate; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS "date",
             count(*)::int AS "count"
      FROM "Activity"
      WHERE "userId" = ${userId}
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}) >= ${from}::timestamp
      GROUP BY 1
      ORDER BY 1`;
    return {
      from,
      to,
      total: days.reduce((sum, day) => sum + day.count, 0),
      days: days.map((day) => ({ date: day.date, count: Number(day.count) })),
    };
  }

  private async completedPerWeek(
    userId: string,
    timeZone: string,
    from: IsoDate,
  ): Promise<{ week: IsoDate; count: number }[]> {
    const rows = await this.prisma.$queryRaw<{ week: IsoDate; count: number }[]>`
      SELECT to_char(date_trunc('week', ("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}), 'YYYY-MM-DD') AS "week",
             count(*)::int AS "count"
      FROM "Task"
      WHERE "userId" = ${userId}
        AND "status" = 'DONE'
        AND "completedAt" IS NOT NULL
        AND (("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}) >= ${from}::timestamp
      GROUP BY 1`;
    return rows.map((row) => ({ week: row.week, count: Number(row.count) }));
  }

  private async dueSoon(userId: string, now: Date): Promise<DueTaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { not: TaskStatus.DONE },
        dueDate: { gte: now, lt: new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: DUE_SOON_LIMIT,
    });
    // dueDate non nul : garanti par le filtre.
    return tasks.map((task) => ({ ...task, dueDate: task.dueDate! }));
  }

  private async recentNotes(userId: string): Promise<RecentNoteDto[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      select: { id: true, title: true, content: true, pinned: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: RECENT_NOTES,
    });
    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      excerpt: noteExcerpt(note.content, 120),
      pinned: note.pinned,
      updatedAt: note.updatedAt,
    }));
  }
}
