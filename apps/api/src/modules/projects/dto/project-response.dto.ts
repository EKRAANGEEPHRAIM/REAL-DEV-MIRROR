import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '../../../generated/prisma/client.js';

export class ProjectTagDto {
  @ApiProperty({ example: 'clx0tag000001' })
  id: string;

  @ApiProperty({ example: 'angular' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#dd0031' })
  color: string | null;
}

export class ProjectProgressDto {
  @ApiProperty({ example: 12, description: 'Nombre total de tâches' })
  total: number;

  @ApiProperty({ example: 5, description: 'Tâches terminées' })
  done: number;

  @ApiProperty({ example: 42, description: 'Pourcentage arrondi (0 sans tâche)' })
  percent: number;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Portfolio SaaS' })
  description: string | null;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    example: ProjectStatus.IN_PROGRESS,
  })
  status: ProjectStatus;

  @ApiProperty({ type: [String], example: ['Angular', 'NestJS'] })
  techStack: string[];

  @ApiProperty({ type: String, nullable: true, example: 'https://github.com/ada/devmirror' })
  repoUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  demoUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;

  @ApiProperty({ type: [ProjectTagDto] })
  tags: ProjectTagDto[];

  @ApiProperty({ type: ProjectProgressDto })
  progress: ProjectProgressDto;

  @ApiProperty({ example: '2026-10-21T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-21T09:00:00.000Z' })
  updatedAt: Date;
}
