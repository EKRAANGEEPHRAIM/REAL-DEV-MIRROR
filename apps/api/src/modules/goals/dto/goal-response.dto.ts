import { ApiProperty } from '@nestjs/swagger';

export class MilestoneDto {
  @ApiProperty({ example: 'clx0mil000001' })
  id: string;

  @ApiProperty({ example: 'Envoyer 10 candidatures' })
  title: string;

  @ApiProperty({ example: false })
  done: boolean;

  @ApiProperty({ example: 0 })
  position: number;
}

export class GoalProjectDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

export class GoalProgressDto {
  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  done: number;

  @ApiProperty({ example: 33, description: 'Pourcentage arrondi (0 sans jalon)' })
  percent: number;
}

export class GoalResponseDto {
  @ApiProperty({ example: 'clx0goal00001' })
  id: string;

  @ApiProperty({ example: 'Décrocher une première mission freelance' })
  title: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-12-31T22:59:59.999Z',
  })
  targetDate: Date | null;

  @ApiProperty({ type: [MilestoneDto] })
  milestones: MilestoneDto[];

  @ApiProperty({ type: [GoalProjectDto] })
  projects: GoalProjectDto[];

  @ApiProperty({ type: GoalProgressDto })
  progress: GoalProgressDto;

  @ApiProperty({ example: false, description: 'Tous les jalons sont faits (au moins un)' })
  completed: boolean;

  @ApiProperty({ example: '2026-10-24T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-24T09:00:00.000Z' })
  updatedAt: Date;
}
