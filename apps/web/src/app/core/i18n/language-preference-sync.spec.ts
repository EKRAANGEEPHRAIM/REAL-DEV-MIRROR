import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from '@devmirror/api-client';
import { sessionResponse } from '../../../testing/auth-fixtures';
import { AuthStore } from '../auth/auth.store';
import { applyLanguage, currentLanguage, type Language } from './language';
import { LanguagePreferenceSync } from './language-preference-sync';
import { loadLanguage, setLanguage } from './translate';

describe('LanguagePreferenceSync', () => {
  let backend: HttpTestingController;
  const user = signal<User | null>(null);
  const setUser = vi.fn((next: User) => user.set(next));
  const account = (language: Language): User => ({
    ...sessionResponse().user,
    preferences: { theme: 'system', language },
  });

  async function setup(local: Language | null) {
    // Dictionnaire anglais chargé d'avance : setLanguage s'applique alors sans attente réseau.
    await loadLanguage('en');
    applyLanguage('fr', false);
    localStorage.clear();
    if (local) applyLanguage(local);
    user.set(null);
    setUser.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { user, setUser } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(LanguagePreferenceSync);
    TestBed.tick();
  }

  afterEach(() => {
    backend.verify();
    applyLanguage('fr', false);
    localStorage.clear();
  });

  const patch = () =>
    backend.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me');

  it('applique la langue du compte à l’ouverture de session, sans la renvoyer', async () => {
    await setup(null);

    user.set(account('en'));
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();

    expect(currentLanguage()).toBe('en');
    backend.expectNone((r) => r.method === 'PATCH');
  });

  it('compte resté en français : le choix explicite de l’appareil l’emporte et est enregistré', async () => {
    await setup('en');

    user.set(account('fr'));
    TestBed.tick();

    expect(currentLanguage()).toBe('en');
    const request = patch();
    expect(request.request.body).toEqual({ preferences: { language: 'en' } });
    request.flush(account('en'));
    expect(setUser).toHaveBeenCalled();
  });

  it('enregistre un changement de langue fait en cours de session', async () => {
    await setup(null);
    user.set(account('fr'));
    TestBed.tick();
    backend.expectNone((r) => r.method === 'PATCH');

    await setLanguage('en');
    TestBed.tick();

    const request = patch();
    expect(request.request.body).toEqual({ preferences: { language: 'en' } });
    request.flush(account('en'));
  });

  it('n’enregistre rien sans session', async () => {
    await setup(null);
    await setLanguage('en');
    TestBed.tick();
    backend.expectNone((r) => r.method === 'PATCH');
  });
});
