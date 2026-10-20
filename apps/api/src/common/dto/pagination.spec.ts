import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { paginate } from './paginated-response.dto.js';
import { PaginationQueryDto, toSkipTake } from './pagination-query.dto.js';
import { parseSort } from './sort.js';

function query(input: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, input);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('PaginationQueryDto', () => {
  it('applique page 1 et 20 éléments par défaut', () => {
    const { dto, errors } = query({});

    expect(errors).toEqual([]);
    expect(toSkipTake(dto)).toEqual({ skip: 0, take: 20 });
  });

  it('convertit les paramètres de l’URL et calcule le décalage', () => {
    const { dto } = query({ page: '3', limit: '10' });

    expect(toSkipTake(dto)).toEqual({ skip: 20, take: 10 });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '101' }, 'limit'],
    [{ limit: 'abc' }, 'limit'],
  ])('refuse %j', (input, property) => {
    expect(query(input).errors).toEqual([property]);
  });
});

describe('paginate', () => {
  it('construit { data, meta } avec le nombre de pages', () => {
    const result = paginate(
      ['a', 'b'],
      42,
      Object.assign(new PaginationQueryDto(), { page: 2, limit: 20 }),
    );

    expect(result).toEqual({
      data: ['a', 'b'],
      meta: { total: 42, page: 2, limit: 20, totalPages: 3 },
    });
  });

  it('compte une page même sans résultat', () => {
    expect(paginate([], 0, new PaginationQueryDto()).meta.totalPages).toBe(1);
  });
});

describe('parseSort', () => {
  const allowed = ['createdAt', 'name'] as const;

  it('lit champ:direction et applique la valeur par défaut sans paramètre', () => {
    expect(parseSort('name:asc', allowed, { createdAt: 'desc' })).toEqual({ name: 'asc' });
    expect(parseSort('name', allowed, { createdAt: 'desc' })).toEqual({ name: 'asc' });
    expect(parseSort(undefined, allowed, { createdAt: 'desc' })).toEqual({ createdAt: 'desc' });
  });

  it.each(['passwordHash:asc', 'name:up'])('refuse %s (400)', (value) => {
    expect(() => parseSort(value, allowed, {})).toThrow(BadRequestException);
  });
});
