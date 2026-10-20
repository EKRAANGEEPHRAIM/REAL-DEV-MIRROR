import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** `?page=1&limit=20` ; à étendre dans les DTO de requête des listes (filtres, tri). */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page doit être un entier' })
  @Min(1, { message: 'page doit être supérieur ou égal à 1' })
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit doit être un entier' })
  @Min(1, { message: 'limit doit être supérieur ou égal à 1' })
  @Max(MAX_PAGE_SIZE, { message: `limit ne peut pas dépasser ${MAX_PAGE_SIZE}` })
  limit: number = DEFAULT_PAGE_SIZE;
}

/** Arguments Prisma `skip` / `take` correspondant à la page demandée. */
export function toSkipTake({ page, limit }: PaginationQueryDto): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}
