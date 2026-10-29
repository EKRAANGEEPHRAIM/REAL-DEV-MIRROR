import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, EMPTY, filter, merge, Subject, switchMap } from 'rxjs';
import { AccountApi } from '../account/account.api';
import { AuthStore } from '../auth/auth.store';
import { type ThemeMode, ThemeStore } from './theme.store';

/** Délai avant d'enregistrer un changement de thème (clics répétés sur le sélecteur). */
export const THEME_SAVE_DELAY = 500;

/**
 * Le thème suit le compte d'un appareil à l'autre. À l'ouverture de session, la préférence du
 * compte s'applique — sauf si le compte en est resté à « système » (valeur par défaut) alors
 * que cet appareil a un choix explicite : ce choix l'emporte et devient celui du compte.
 * Ensuite, chaque changement (menu du haut ou Paramètres) est enregistré.
 * Démarré par le shell de l'espace connecté (il suffit de l'injecter).
 */
@Injectable({ providedIn: 'root' })
export class ThemePreferenceSync {
  private readonly auth = inject(AuthStore);
  private readonly theme = inject(ThemeStore);
  private readonly api = inject(AccountApi);
  private readonly saveNow = new Subject<ThemeMode>();
  private appliedFor: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.appliedFor = null;
        return;
      }
      if (this.appliedFor === user.id) return;
      this.appliedFor = user.id;

      untracked(() => {
        const local = this.theme.mode();
        if (user.preferences.theme === 'system' && local !== 'system') {
          this.saveNow.next(local);
        } else {
          this.theme.setMode(user.preferences.theme);
        }
      });
    });

    merge(toObservable(this.theme.mode).pipe(debounceTime(THEME_SAVE_DELAY)), this.saveNow)
      .pipe(
        filter((mode) => this.differsFromProfile(mode)),
        switchMap((theme) =>
          // Échec silencieux : le thème reste appliqué localement, réessayé au prochain changement.
          this.api.updateProfile({ preferences: { theme } }).pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((user) => this.auth.setUser(user));
  }

  private differsFromProfile(mode: ThemeMode): boolean {
    const user = this.auth.user();
    return !!user && this.appliedFor === user.id && user.preferences.theme !== mode;
  }
}
