import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export const GOAL_SORT_FIELDS = ['targetDate', 'createdAt', 'updatedAt', 'title'] as const;
export const GOAL_STATES = ['active', 'completed'] as const;
export type GoalState = (typeof GOAL_STATES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GoalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: GOAL_STATES,
    description: 'completed : tous les jalons faits (au moins un) ; active : les autres',
  })
  @IsOptional()
  @IsIn(GOAL_STATES, { message: 'state doit valoir active ou completed' })
  state?: GoalState;

  @ApiPropertyOptional({ description: 'Objectifs liés à ce projet' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Recherche dans le titre et la description' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description: `Tri : ${GOAL_SORT_FIELDS.join(', ')} suivi de :asc ou :desc`,
    example: 'targetDate:asc',
    default: 'targetDate:asc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
