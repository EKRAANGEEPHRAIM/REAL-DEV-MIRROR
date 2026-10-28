import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { SearchResults } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCornerDownLeft,
  lucideFolderKanban,
  lucideFolderPlus,
  lucideLayoutDashboard,
  lucideLoader2,
  lucideNotebookPen,
  lucidePin,
  lucideSearch,
  lucideSettings,
  lucideSquare,
  lucideSquareCheckBig,
  lucideStickyNote,
  lucideSunMoon,
  lucideTarget,
} from '@ng-icons/lucide';
import { type BrnDialogRef, BrnDialogRef as DialogRef } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { NotesApi } from '../../features/notes/data/notes.api';
import { UNTITLED_NOTE } from '../../features/notes/note-defaults';
import { ProjectDialogs } from '../../features/projects/form/project-dialogs';
import { apiErrorMessage } from '../http/api-error';
import { ThemeStore } from '../theme/theme.store';
import {
  buildPalette,
  MIN_SEARCH_LENGTH,
  type PaletteCommand,
  type PaletteItem,
} from './palette-items';
import { SearchApi } from './search.api';

/** Délai sans frappe avant d'interroger l'API. */
export const SEARCH_DEBOUNCE = 200;

/**
 * Palette de commandes (Ctrl+K) : recherche globale et actions rapides. Motif « combobox » :
 * le focus reste dans le champ, ↑/↓ déplacent l'option active (aria-activedescendant).
 */
@Component({
  selector: 'dm-command-palette',
  imports: [NgIcon, HlmDialogImports],
  providers: [
    provideIcons({
      lucideCornerDownLeft,
      lucideFolderKanban,
      lucideFolderPlus,
      lucideLayoutDashboard,
      lucideLoader2,
      lucideNotebookPen,
      lucidePin,
      lucideSearch,
      lucideSettings,
      lucideSquare,
      lucideSquareCheckBig,
      lucideStickyNote,
      lucideSunMoon,
      lucideTarget,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 hlmDialogTitle class="sr-only">Rechercher ou lancer une action</h2>
    <div class="flex items-center gap-2 border-b px-4">
      <ng-icon name="lucideSearch" class="text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        id="palette-input"
        class="placeholder:text-muted-foreground h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
        placeholder="Rechercher un projet, une tâche, une note… ou une action"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        [attr.aria-activedescendant]="activeItem()?.id ?? null"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
        (keydown)="onKeydown($event)"
      />
      @if (loading()) {
        <ng-icon
          name="lucideLoader2"
          class="text-muted-foreground motion-safe:animate-spin"
          aria-label="Recherche en cours"
        />
      }
    </div>

    <div
      id="palette-list"
      role="listbox"
      aria-label="Résultats et actions"
      class="max-h-[min(60vh,28rem)] overflow-y-auto p-2"
    >
      @for (section of palette().sections; track section.group) {
        <div role="group" [attr.aria-labelledby]="'palette-group-' + $index">
          <p
            [id]="'palette-group-' + $index"
            class="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium"
          >
            {{ section.group }}
          </p>
          @for (entry of section.items; track entry.item.id) {
            <!-- Le focus reste dans le champ (aria-activedescendant) ; tabindex -1 : jamais dans l'ordre Tab -->
            <div
              role="option"
              tabindex="-1"
              class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm"
              [id]="entry.item.id"
              (keydown.enter)="run(entry.item)"
              [class.bg-accent]="entry.index === active()"
              [class.text-accent-foreground]="entry.index === active()"
              [attr.aria-selected]="entry.index === active()"
              (mousemove)="active.set(entry.index)"
              (click)="run(entry.item)"
            >
              @if (entry.item.color) {
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  [style.background-color]="entry.item.color"
                  aria-hidden="true"
                ></span>
              } @else {
                <ng-icon
                  [name]="entry.item.icon"
                  class="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ entry.item.label }}</span>
                @if (entry.item.hint) {
                  <span class="text-muted-foreground block truncate text-xs">{{
                    entry.item.hint
                  }}</span>
                }
              </span>
              @if (entry.index === active()) {
                <ng-icon
                  name="lucideCornerDownLeft"
                  class="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              }
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground px-2 py-8 text-center text-sm" role="status">
          @if (loading()) {
            Recherche…
          } @else {
            Aucun résultat pour « {{ query().trim() }} ».
          }
        </p>
      }
      @if (failed()) {
        <p class="text-destructive px-2 py-2 text-xs" role="status">
          La recherche n’a pas abouti ; les actions restent disponibles.
        </p>
      }
    </div>

    <footer
      class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
      aria-hidden="true"
    >
      <span><kbd class="font-sans">↑</kbd> <kbd class="font-sans">↓</kbd> naviguer</span>
      <span><kbd class="font-sans">↵</kbd> ouvrir</span>
      <span><kbd class="font-sans">Échap</kbd> fermer</span>
    </footer>
  `,
})
export class CommandPaletteDialog {
  private readonly ref = inject<BrnDialogRef<void>>(DialogRef);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeStore);
  private readonly notes = inject(NotesApi);
  private readonly projectDialogs = inject(ProjectDialogs);
  private readonly searchApi = inject(SearchApi);

  protected readonly query = signal('');
  private readonly results = signal<SearchResults | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly palette = computed(() => buildPalette(this.query(), this.results()));
  /** Revient sur la première entrée à chaque nouvelle liste. */
  protected readonly active = linkedSignal(() => (this.palette().items.length, 0));
  protected readonly activeItem = computed(() => this.palette().items[this.active()]);

  constructor() {
    toObservable(this.query)
      .pipe(
        map((q) => q.trim()),
        debounceTime(SEARCH_DEBOUNCE),
        distinctUntilChanged(),
        tap((q) => {
          this.failed.set(false);
          this.loading.set(q.length >= MIN_SEARCH_LENGTH);
        }),
        switchMap((q) =>
          q.length < MIN_SEARCH_LENGTH
            ? of(null)
            : this.searchApi.search(q).pipe(
                catchError(() => {
                  this.failed.set(true);
                  return of(null);
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.results.set(results);
        this.loading.set(false);
      });

    // L'option active reste visible quand on la déplace au clavier.
    effect(() => {
      const id = this.activeItem()?.id;
      if (id) this.document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.palette().items.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((index) => (index + step + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.activeItem();
      if (item) this.run(item);
    }
  }

  protected run(item: PaletteItem): void {
    this.ref.close();
    const target = item.target;
    if (target.kind === 'link') {
      void this.router.navigate(target.commands, { queryParams: target.queryParams });
    } else {
      this.runCommand(target.command);
    }
  }

  private runCommand(command: PaletteCommand): void {
    switch (command) {
      case 'toggle-theme':
        this.theme.setMode(this.theme.isDark() ? 'light' : 'dark');
        break;
      case 'new-note':
        this.notes.create({ title: UNTITLED_NOTE }).subscribe({
          next: (note) => void this.router.navigate(['/notes', note.id]),
          error: (error: unknown) => toast.error(apiErrorMessage(error)),
        });
        break;
      case 'new-project':
        this.projectDialogs.open().subscribe((project) => {
          toast.success(`Projet « ${project.name} » créé`);
          void this.router.navigate(['/projects', project.id]);
        });
        break;
    }
  }
}
