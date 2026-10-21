import { ApiProperty } from '@nestjs/swagger';
import { Priority, TaskStatus } from '../../../generated/prisma/client.js';

export class TaskProjectDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

export class SubtaskDto {
  @ApiProperty({ example: 'clx0sub000001' })
  id: string;

  @ApiProperty({ example: 'Cas nominal' })
  title: string;

  @ApiProperty({ example: false })
  done: boolean;

  @ApiProperty({ example: 0 })
  position: number;
}

export class TaskResponseDto {
  @ApiProperty({ example: 'clx0task00001' })
  id: string;

  @ApiProperty({ example: 'Écrire les tests du module tasks' })
  title: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description: string | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus', example: TaskStatus.TODO })
  status: TaskStatus;

  @ApiProperty({ enum: Priority, enumName: 'Priority', example: Priority.MEDIUM })
  priority: Priority;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-30T17:00:00.000Z',
  })
  dueDate: Date | null;

  @ApiProperty({ example: 0, description: 'Position dans la colonne du Kanban' })
  position: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  completedAt: Date | null;

  @ApiProperty({ type: TaskProjectDto, nullable: true })
  project: TaskProjectDto | null;

  @ApiProperty({ type: [SubtaskDto] })
  subtasks: SubtaskDto[];

  @ApiProperty({ example: '2026-10-22T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-22T09:00:00.000Z' })
  updatedAt: Date;
}
