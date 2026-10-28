import { afterNextRender, DestroyRef, type ElementRef, inject, signal } from '@angular/core';

/**
 * Largeur en pixels d'un élément, suivie avec ResizeObserver : les graphiques se dessinent
 * à leur vraie taille (texte lisible) au lieu d'étirer un viewBox. `fallback` sert avant le
 * premier rendu et dans les environnements sans ResizeObserver (tests).
 */
export function elementWidth(element: () => ElementRef<HTMLElement> | undefined, fallback: number) {
  const width = signal(fallback);
  const destroyRef = inject(DestroyRef);

  afterNextRender(() => {
    const node = element()?.nativeElement;
    if (!node) return;
    if (node.clientWidth) width.set(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) width.set(next);
    });
    observer.observe(node);
    destroyRef.onDestroy(() => observer.disconnect());
  });

  return width.asReadonly();
}
