import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Priority, ProjectStatus, TaskStatus } from '../../../generated/prisma/client.js';

export const MAX_SEARCH_LIMIT = 20;

export class SearchQueryDto {
  @ApiProperty({ description: 'Texte recherché (2 caractères au moins)', example: 'jwt' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100, { message: 'La recherche doit contenir entre 2 et 100 caractères' })
  q: string;

  @ApiPropertyOptional({
    description: 'Résultats au plus par catégorie',
    default: 5,
    minimum: 1,
    maximum: MAX_SEARCH_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit: number = 5;
}

export class SearchProjectRefDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

export class ProjectHitDto extends SearchProjectRefDto {
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus;
}

export class TaskHitDto {
  @ApiProperty({ example: 'clx0task00001' })
  id: string;

  @ApiProperty({ example: 'Écrire les tests du refresh JWT' })
  title: string;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ enum: Priority, enumName: 'Priority' })
  priority: Priority;

  @ApiProperty({ type: SearchProjectRefDto, nullable: true })
  project: SearchProjectRefDto | null;
}

export class NoteHitDto {
  @ApiProperty({ example: 'clx0note00001' })
  id: string;

  @ApiProperty({ example: 'Pièges du rafraîchissement JWT' })
  title: string;

  @ApiProperty({ example: 'Un refresh token ne sert qu’une fois.' })
  excerpt: string;

  @ApiProperty({ example: false })
  pinned: boolean;
}

export class SearchResultsDto {
  @ApiProperty({ example: 'jwt' })
  q: string;

  @ApiProperty({ type: [ProjectHitDto] })
  projects: ProjectHitDto[];

  @ApiProperty({ type: [TaskHitDto] })
  tasks: TaskHitDto[];

  @ApiProperty({ type: [NoteHitDto] })
  notes: NoteHitDto[];
}
