import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Rend une route accessible sans jeton d'accès (toutes les routes sont protégées par défaut). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
