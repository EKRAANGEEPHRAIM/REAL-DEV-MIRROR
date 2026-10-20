import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { PaginationQueryDto } from './pagination-query.dto.js';

export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: 'Nombre total d’éléments correspondant aux filtres' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

/** Forme commune des listes paginées : `{ data, meta }`. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMetaDto;
}

export function paginate<T>(data: T[], total: number, query: PaginationQueryDto): Paginated<T> {
  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** Documente une réponse paginée de `model` dans Swagger (et donc dans le client généré). */
export function ApiPaginatedResponse<T>(model: Type<T>, description?: string) {
  return applyDecorators(
    ApiExtraModels(PaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
