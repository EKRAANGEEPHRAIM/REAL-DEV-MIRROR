import { DOCUMENT } from '@angular/common';
import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'devmirror.theme';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredMode(storage: Storage | undefined): ThemeMode {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Thème clair / sombre / système, mémorisé dans le navigateur et appliqué sur <html class="dark">. */
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState({ mode: 'system' as ThemeMode, systemPrefersDark: false }),
  withComputed(({ mode, systemPrefersDark }) => ({
    isDark: computed(() => mode() === 'dark' || (mode() === 'system' && systemPrefersDark())),
  })),
  withMethods((store) => ({
    setMode(mode: ThemeMode): void {
      patchState(store, { mode });
    },
  })),
  withHooks({
    onInit(store) {
      const document = inject(DOCUMENT);
      const window = document.defaultView ?? undefined;
      const media = window?.matchMedia?.('(prefers-color-scheme: dark)');

      patchState(store, {
        mode: readStoredMode(window?.localStorage),
        systemPrefersDark: media?.matches ?? false,
      });
      media?.addEventListener('change', (event) =>
        patchState(store, { systemPrefersDark: event.matches }),
      );

      effect(() => {
        const dark = store.isDark();
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      });

      effect(() => {
        const mode = store.mode();
        try {
          window?.localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch {
          // Stockage indisponible (navigation privée) : le thème reste valable pour la session.
        }
      });
    },
  }),
);
