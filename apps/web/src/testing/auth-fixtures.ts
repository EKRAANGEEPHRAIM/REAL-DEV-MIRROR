import type { AuthResponse } from '@devmirror/api-client';

/** Réponse d'authentification de test (login, register, refresh). */
export const sessionResponse = (token = 'jwt-1'): AuthResponse => ({
  accessToken: token,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'ada@devmirror.dev',
    name: 'Ada Lovelace',
    avatarUrl: null,
    emailVerified: true,
    createdAt: '2026-10-19T09:00:00.000Z',
  },
});
