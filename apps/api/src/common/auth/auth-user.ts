import type { Request } from 'express';

/** Utilisateur authentifié, extrait du jeton d'accès par JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
}

/** Contenu signé du jeton d'accès. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
