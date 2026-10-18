import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'dm_refresh';

/**
 * Le cookie n'est envoyé qu'aux routes /api/v1/auth. En production, le front appelle l'API
 * via une réécriture Vercel (même origine) : SameSite=Strict suffit contre le CSRF.
 */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(secure: boolean, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(expiresAt && { expires: expiresAt }),
  };
}
