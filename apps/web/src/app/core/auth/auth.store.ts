import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  exhaustMap,
  finalize,
  map,
  type Observable,
  of,
  pipe,
  share,
  tap,
  throwError,
} from 'rxjs';
import { apiErrorMessage } from '../http/api-error';
import { AuthApi } from './auth.api';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@devmirror/api-client';

/** restoring : session en cours de restauration au démarrage (refresh silencieux). */
export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

interface AuthState {
  user: User | null;
  /** Gardé en mémoire uniquement (jamais dans localStorage) : invisible pour un script injecté. */
  accessToken: string | null;
  status: AuthStatus;
  pending: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'restoring',
  pending: false,
  error: null,
};

export const DEFAULT_REDIRECT = '/dashboard';

/** N'accepte que des chemins internes, pour qu'un lien piégé ne redirige pas hors du site. */
export function safeReturnUrl(url: string | null | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : DEFAULT_REDIRECT;
}

export function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export interface AuthRequest<T> {
  credentials: T;
  returnUrl?: string | null;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, status }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
    initials: computed(() => initialsOf(user()?.name)),
  })),
  withMethods((store, api = inject(AuthApi), router = inject(Router)) => {
    // Un seul refresh à la fois : les requêtes qui reçoivent un 401 en même temps l'attendent.
    let refreshInFlight: Observable<string> | null = null;

    const startSession = (response: AuthResponse) =>
      patchState(store, {
        user: response.user,
        accessToken: response.accessToken,
        status: 'authenticated',
        pending: false,
        error: null,
      });

    const clearSession = () =>
      patchState(store, { user: null, accessToken: null, status: 'anonymous', pending: false });

    /** Connexion ou inscription : même déroulé, seul l'appel change. */
    const authenticate = <T>(call: (credentials: T) => Observable<AuthResponse>) =>
      rxMethod<AuthRequest<T>>(
        pipe(
          tap(() => patchState(store, { pending: true, error: null })),
          exhaustMap(({ credentials, returnUrl }) =>
            call(credentials).pipe(
              tapResponse({
                next: (response) => {
                  startSession(response);
                  void router.navigateByUrl(safeReturnUrl(returnUrl));
                },
                error: (error) =>
                  patchState(store, { pending: false, error: apiErrorMessage(error) }),
              }),
            ),
          ),
        ),
      );

    return {
      login: authenticate<LoginRequest>((credentials) => api.login(credentials)),
      register: authenticate<RegisterRequest>((credentials) => api.register(credentials)),

      logout: rxMethod<void>(
        pipe(
          exhaustMap(() =>
            api.logout().pipe(
              // Même si l'API est injoignable, la session locale est fermée.
              catchError(() => of(undefined)),
              tap(() => {
                clearSession();
                void router.navigateByUrl('/login');
              }),
            ),
          ),
        ),
      ),

      /** Utilisé par l'intercepteur et au démarrage : renvoie un nouveau jeton d'accès. */
      refreshAccessToken(): Observable<string> {
        refreshInFlight ??= api.refresh().pipe(
          tap(startSession),
          map((response) => response.accessToken),
          catchError((error: unknown) => {
            clearSession();
            return throwError(() => error);
          }),
          finalize(() => (refreshInFlight = null)),
          share(),
        );
        return refreshInFlight;
      },

      clearSession,
      clearError: () => patchState(store, { error: null }),

      /** Profil ou avatar modifié : la version renvoyée par l'API remplace l'actuelle. */
      setUser: (user: User) => {
        if (store.user()) patchState(store, { user });
      },

      /** Après une vérification réussie : met à jour la session ouverte, s'il y en a une. */
      markEmailVerified: () => {
        const user = store.user();
        if (user) patchState(store, { user: { ...user, emailVerified: true } });
      },
    };
  }),
  withHooks({
    onInit(store) {
      // Restaure la session depuis le cookie httpOnly ; sans cookie valide, statut anonyme.
      store.refreshAccessToken().subscribe({ error: () => undefined });
    },
  }),
);
