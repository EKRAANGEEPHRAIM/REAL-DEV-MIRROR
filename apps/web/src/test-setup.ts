// Données de locale fr (DatePipe) comme dans l'application.
import './app/core/locale';

// jsdom n'implémente pas matchMedia, utilisé par ThemeStore et les overlays CDK.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
