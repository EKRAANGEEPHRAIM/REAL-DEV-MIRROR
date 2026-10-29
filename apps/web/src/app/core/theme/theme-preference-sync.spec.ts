import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from '@devmirror/api-client';
import { sessionResponse } from '../../../testing/auth-fixtures';
import { AuthStore } from '../auth/auth.store';
import { THEME_SAVE_DELAY, ThemePreferenceSync } from './theme-preference-sync';
import { ThemeStore } from './theme.store';

describe('ThemePreferenceSync', () => {
  let backend: HttpTestingController;
  const user = signal<User | null>(null);
  const setUser = vi.fn((next: User) => user.set(next));
  const account = (theme: User['preferences']['theme']): User => ({
    ...sessionResponse().user,
    preferences: { theme, language: 'fr' },
  });

  function setup(localMode: 'light' | 'dark' | 'system') {
    vi.useFakeTimers();
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
    const theme = TestBed.inject(ThemeStore);
    theme.setMode(localMode);
    TestBed.inject(ThemePreferenceSync);
    TestBed.tick();
    return theme;
  }

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const patch = () =>
    backend.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me');

  it('applique la préférence du compte à l’ouverture de session, sans la renvoyer', () => {
    const theme = setup('light');

    user.set(account('dark'));
    TestBed.tick();
    vi.advanceTimersByTime(THEME_SAVE_DELAY);

    expect(theme.mode()).toBe('dark');
    backend.expectNone((r) => r.method === 'PATCH');
  });

  it('compte resté sur « système » : le choix explicite de l’appareil l’emporte et est enregistré', () => {
    const theme = setup('dark');

    user.set(account('system'));
    TestBed.tick();

    expect(theme.mode()).toBe('dark');
    const request = patch();
    expect(request.request.body).toEqual({ preferences: { theme: 'dark' } });
    request.flush(account('dark'));
    expect(setUser).toHaveBeenCalled();
  });

  it('enregistre un changement de thème après une courte pause', () => {
    const theme = setup('system');
    user.set(account('system'));
    TestBed.tick();
    vi.advanceTimersByTime(THEME_SAVE_DELAY);
    backend.expectNone((r) => r.method === 'PATCH');

    theme.setMode('light');
    TestBed.tick();
    theme.setMode('dark');
    TestBed.tick();
    vi.advanceTimersByTime(THEME_SAVE_DELAY);

    const request = patch();
    expect(request.request.body).toEqual({ preferences: { theme: 'dark' } });
    request.flush(account('dark'));
  });

  it('n’enregistre rien sans session', () => {
    const theme = setup('system');
    theme.setMode('dark');
    TestBed.tick();
    vi.advanceTimersByTime(THEME_SAVE_DELAY);
    backend.expectNone((r) => r.method === 'PATCH');
  });
});
