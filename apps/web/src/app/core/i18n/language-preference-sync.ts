import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, filter, merge, Subject, switchMap } from 'rxjs';
import { AccountApi } from '../account/account.api';
import { AuthStore } from '../auth/auth.store';
import { currentLanguage, type Language, storedLanguage } from './language';
import { setLanguage } from './translate';

/**
 * La langue suit le compte, comme le thème. À l'ouverture de session, la langue du compte
 * s'applique — sauf si le compte en est resté au français par défaut alors que cet appareil
 * a un choix explicite (sélecteur des pages publiques) : ce choix devient celui du compte.
 * Ensuite, chaque changement (Paramètres, pages publiques) est enregistré.
 * Démarré par le shell de l'espace connecté (il suffit de l'injecter).
 */
@Injectable({ providedIn: 'root' })
export class LanguagePreferenceSync {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(AccountApi);
  private readonly saveNow = new Subject<Language>();
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
        const local = storedLanguage();
        const account = user.preferences.language;
        if (account === 'fr' && local && local !== 'fr') {
          this.saveNow.next(local);
        } else if (account !== currentLanguage()) {
          void setLanguage(account);
        }
      });
    });

    merge(toObservable(currentLanguage), this.saveNow)
      .pipe(
        filter((language) => this.differsFromProfile(language)),
        switchMap((language) =>
          this.api.updateProfile({ preferences: { language } }).pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((user) => this.auth.setUser(user));
  }

  private differsFromProfile(language: Language): boolean {
    const user = this.auth.user();
    return !!user && this.appliedFor === user.id && user.preferences.language !== language;
  }
}
