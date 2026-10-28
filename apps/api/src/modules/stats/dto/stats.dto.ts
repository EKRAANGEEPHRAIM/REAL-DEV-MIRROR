import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateBy } from 'class-validator';
import { Priority, ProjectStatus, TaskStatus } from '../../../generated/prisma/client.js';
import { isTimeZone } from '../stats-calendar.js';

export class StatsQueryDto {
  @ApiPropertyOptional({
    description: 'Fuseau IANA de l’utilisateur : semaines et jours sont comptés dans ce fuseau',
    example: 'Europe/Paris',
    default: 'UTC',
  })
  @IsOptional()
  @ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) => isTimeZone(value),
      defaultMessage: () => 'Fuseau horaire inconnu (format IANA, par ex. Europe/Paris)',
    },
  })
  tz: string = 'UTC';
}

export class StatsIndicatorsDto {
  @ApiProperty({ example: 3, description: 'Projets « en cours »' })
  activeProjects: number;

  @ApiProperty({ example: 14, description: 'Tâches non terminées' })
  openTasks: number;

  @ApiProperty({ example: 5, description: 'Tâches terminées depuis lundi' })
  tasksCompletedThisWeek: number;

  @ApiProperty({ example: 2, description: 'Tâches non terminées dont l’échéance est passée' })
  overdueTasks: number;

  @ApiProperty({ example: 2 })
  activeGoals: number;

  @ApiProperty({ example: 1 })
  completedGoals: number;

  @ApiProperty({ example: 12 })
  notes: number;

  @ApiProperty({ example: 4, description: 'Jours consécutifs avec activité (jusqu’à hier inclus)' })
  currentStreak: number;

  @ApiProperty({ example: 9, description: 'Plus longue série sur la période de la heatmap' })
  longestStreak: number;
}

export class WeekCountDto {
  @ApiProperty({ example: '2026-10-26', description: 'Lundi de la semaine (fuseau demandé)' })
  weekStart: string;

  @ApiProperty({ example: 5 })
  count: number;
}

export class StatusCountDto {
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus;

  @ApiProperty({ example: 2 })
  count: number;
}

export class StatsProjectRefDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

export class DueTaskDto {
  @ApiProperty({ example: 'clx0task00001' })
  id: string;

  @ApiProperty({ example: 'Préparer la démo' })
  title: string;

  @ApiProperty({ example: '2026-10-30T22:59:59.999Z' })
  dueDate: Date;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ enum: Priority, enumName: 'Priority' })
  priority: Priority;

  @ApiProperty({ type: StatsProjectRefDto, nullable: true })
  project: StatsProjectRefDto | null;
}

export class RecentNoteDto {
  @ApiProperty({ example: 'clx0note00001' })
  id: string;

  @ApiProperty({ example: 'Pièges du rafraîchissement JWT' })
  title: string;

  @ApiProperty({ example: 'Un refresh token ne sert qu’une fois.' })
  excerpt: string;

  @ApiProperty({ example: false })
  pinned: boolean;

  @ApiProperty({ example: '2026-10-27T18:00:00.000Z' })
  updatedAt: Date;
}

export class DayCountDto {
  @ApiProperty({ example: '2026-10-27' })
  date: string;

  @ApiProperty({ example: 3 })
  count: number;
}

export class ActivityCalendarDto {
  @ApiProperty({ example: '2025-10-27', description: 'Premier jour (un lundi, 53 semaines)' })
  from: string;

  @ApiProperty({ example: '2026-10-28', description: 'Aujourd’hui dans le fuseau demandé' })
  to: string;

  @ApiProperty({ example: 87, description: 'Actions sur la période' })
  total: number;

  @ApiProperty({
    type: [DayCountDto],
    description: 'Jours avec au moins une action seulement, dans l’ordre chronologique',
  })
  days: DayCountDto[];
}

export class StatsOverviewDto {
  @ApiProperty({ example: 'Europe/Paris' })
  timeZone: string;

  @ApiProperty({ example: '2026-10-28', description: 'Aujourd’hui dans le fuseau demandé' })
  today: string;

  @ApiProperty({ type: StatsIndicatorsDto })
  indicators: StatsIndicatorsDto;

  @ApiProperty({
    type: [WeekCountDto],
    description: '12 semaines, de la plus ancienne à la courante',
  })
  tasksCompletedPerWeek: WeekCountDto[];

  @ApiProperty({ type: [StatusCountDto], description: 'Tous les statuts, même à 0' })
  projectsByStatus: StatusCountDto[];

  @ApiProperty({
    type: [DueTaskDto],
    description: 'Non terminées, échéance dans les 7 prochains jours (10 au plus)',
  })
  dueSoon: DueTaskDto[];

  @ApiProperty({ type: [RecentNoteDto], description: '5 dernières notes modifiées' })
  recentNotes: RecentNoteDto[];

  @ApiProperty({ type: ActivityCalendarDto })
  activity: ActivityCalendarDto;
}
