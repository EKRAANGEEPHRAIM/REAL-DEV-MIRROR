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

// jsdom n'implémente pas IntersectionObserver, utilisé par @defer (on viewport) : tout élément
// observé est considéré comme visible, le contenu différé s'affiche donc comme sans @defer.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class VisibleIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element): void {
      queueMicrotask(() =>
        this.callback(
          [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        ),
      );
    }
    unobserve(): void {
      // rien à faire
    }
    disconnect(): void {
      // rien à faire
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
}
