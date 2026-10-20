import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'asc' | 'desc';

/** `{ champ: direction }` : la forme d'un `orderBy` Prisma sur un champ scalaire. */
export type SortOrder<Field extends string> = Partial<Record<Field, SortDirection>>;

/**
 * Lit `?sort=champ:direction` (ex. `createdAt:desc`). Seuls les champs de `allowed` sont
 * acceptés : le client ne peut pas trier sur une colonne non prévue (ni sonder le schéma).
 */
export function parseSort<Field extends string>(
  value: string | undefined,
  allowed: readonly Field[],
  fallback: SortOrder<Field>,
): SortOrder<Field> {
  if (!value) return fallback;

  const [field, direction = 'asc'] = value.split(':');
  if (!allowed.includes(field as Field) || (direction !== 'asc' && direction !== 'desc')) {
    throw new BadRequestException(
      `Tri invalide « ${value} » : champs possibles ${allowed.join(', ')} ; direction asc ou desc`,
    );
  }
  return { [field]: direction } as SortOrder<Field>;
}
