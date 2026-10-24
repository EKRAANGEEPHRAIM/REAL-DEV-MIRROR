import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import type { Project, Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBold,
  lucideCheck,
  lucideCloudAlert,
  lucideCode,
  lucideColumns2,
  lucideEye,
  lucideHeading2,
  lucideItalic,
  lucideLink,
  lucideList,
  lucideLoader2,
  lucidePencilLine,
  lucidePin,
  lucidePinOff,
  lucideQuote,
  lucideSearchX,
  lucideSquareCode,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { TagsApi } from '../../../shared/data/tags.api';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { MarkdownPipe } from '../../../shared/markdown/markdown';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { ProjectsApi } from '../../projects/data/projects.api';
import { NoteEditorStore } from '../data/note-editor.store';
import { NotesApi } from '../data/notes.api';
import { UNTITLED_NOTE } from '../note-defaults';
import { applyFormat, FORMAT_ACTIONS, type MarkdownFormat } from './markdown-format';

export type EditorView = 'write' | 'preview' | 'split';

const VIEWS: readonly { value: EditorView; label: string; icon: string }[] = [
  { value: 'write', label: 'Écrire', icon: 'lucidePencilLine' },
  { value: 'split', label: 'Côte à côte', icon: 'lucideColumns2' },
  { value: 'preview', label: 'Aperçu', icon: 'lucideEye' },
];

const SELECT_CLASSES =
  'border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2';

@Component({
  selector: 'dm-note-editor-page',
  imports: [
    RouterLink,
    NgIcon,
    HlmButtonImports,
    HlmSkeletonImports,
    FormAlert,
    MarkdownPipe,
    RelativeTimePipe,
  ],
  providers: [
    NoteEditorStore,
    provideIcons({
      lucideArrowLeft,
      lucideBold,
      lucideCheck,
      lucideCloudAlert,
      lucideCode,
      lucideColumns2,
      lucideEye,
      lucideHeading2,
      lucideItalic,
      lucideLink,
      lucideList,
      lucideLoader2,
      lucidePencilLine,
      lucidePin,
      lucidePinOff,
      lucideQuote,
      lucideSearchX,
      lucideSquareCode,
      lucideTrash2,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'warnIfUnsaved($event)' },
  template: `
    <a hlmBtn variant="ghost" size="sm" routerLink="/notes" class="-ms-2 mb-4">
      <ng-icon name="lucideArrowLeft" aria-hidden="true" />
      Notes
    </a>

    @switch (store.status()) {
      @case ('loading') {
        <div class="flex flex-col gap-4" aria-busy="true" aria-label="Chargement de la note">
          <hlm-skeleton class="h-9 w-1/2" />
          <hlm-skeleton class="h-8 w-full" />
          <hlm-skeleton class="h-96 w-full" />
        </div>
      }
      @case ('not-found') {
        <section
          class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <ng-icon name="lucideSearchX" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h1 class="text-lg font-medium">Note introuvable</h1>
          <p class="text-muted-foreground text-sm">Elle a peut-être été supprimée.</p>
          <a hlmBtn variant="outline" routerLink="/notes">Retour aux notes</a>
        </section>
      }
      @case ('error') {
        <dm-form-alert class="max-w-xl">{{ store.error() }}</dm-form-alert>
      }
      @default {
        @let note = store.note()!;
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-muted-foreground flex items-center gap-1.5 text-sm" role="status">
              @switch (store.save()) {
                @case ('saving') {
                  <ng-icon
                    name="lucideLoader2"
                    class="motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  Enregistrement…
                }
                @case ('pending') {
                  {{
                    store.titleInvalid()
                      ? 'Donnez un titre à la note pour l’enregistrer'
                      : 'Modifications en attente…'
                  }}
                }
                @case ('error') {
                  <ng-icon name="lucideCloudAlert" class="text-destructive" aria-hidden="true" />
                  <span class="text-destructive">Échec de l’enregistrement</span>
                  <button
                    type="button"
                    class="underline underline-offset-2"
                    (click)="store.saveNow()"
                  >
                    Réessayer
                  </button>
                }
                @default {
                  <ng-icon name="lucideCheck" aria-hidden="true" />
                  Enregistré {{ store.savedAt() | relativeTime }}
                }
              }
            </p>
            <div class="flex items-center gap-1">
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                [attr.aria-pressed]="note.pinned"
                (click)="store.updateMeta({ pinned: !note.pinned })"
              >
                <ng-icon [name]="note.pinned ? 'lucidePinOff' : 'lucidePin'" aria-hidden="true" />
                {{ note.pinned ? 'Désépingler' : 'Épingler' }}
              </button>
              <button hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="remove()">
                <ng-icon name="lucideTrash2" aria-hidden="true" />
                Supprimer
              </button>
            </div>
          </div>

          <label for="note-title" class="sr-only">Titre de la note</label>
          <input
            #titleInput
            id="note-title"
            class="placeholder:text-muted-foreground w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
            placeholder="Titre de la note"
            maxlength="200"
            [value]="store.title()"
            [attr.aria-invalid]="store.titleInvalid()"
            (input)="store.edit({ title: $any($event.target).value })"
            (keydown.enter)="$event.preventDefault(); editor()?.nativeElement?.focus()"
          />

          <div class="flex flex-wrap items-center gap-2 text-sm">
            <label for="note-project" class="text-muted-foreground">Projet</label>
            <select
              id="note-project"
              [class]="selectClasses"
              (change)="store.updateMeta({ projectId: $any($event.target).value || null })"
            >
              <option value="" [selected]="!note.project">Aucun</option>
              @for (project of projects(); track project.id) {
                <option [value]="project.id" [selected]="note.project?.id === project.id">
                  {{ project.name }}
                </option>
              }
            </select>
            @if (tags().length) {
              <span class="text-muted-foreground ms-2" id="note-tags-label">Tags</span>
              <div class="flex flex-wrap gap-1" role="group" aria-labelledby="note-tags-label">
                @for (tag of tags(); track tag.id) {
                  <button
                    type="button"
                    class="rounded-full border px-2 py-0.5 text-xs transition-colors"
                    [class.bg-primary]="tagIds().has(tag.id)"
                    [class.text-primary-foreground]="tagIds().has(tag.id)"
                    [attr.aria-pressed]="tagIds().has(tag.id)"
                    (click)="toggleTag(tag.id)"
                  >
                    #{{ tag.name }}
                  </button>
                }
              </div>
            }
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 border-y py-1.5">
            <div class="flex flex-wrap gap-0.5" role="toolbar" aria-label="Mise en forme">
              @for (action of formatActions; track action.format) {
                <button
                  type="button"
                  hlmBtn
                  variant="ghost"
                  size="icon-sm"
                  [disabled]="view() === 'preview'"
                  [attr.aria-label]="action.label"
                  [title]="
                    action.shortcut ? action.label + ' (' + action.shortcut + ')' : action.label
                  "
                  (click)="format(action.format)"
                >
                  <ng-icon [name]="action.icon" aria-hidden="true" />
                </button>
              }
            </div>
            <div class="bg-muted inline-flex rounded-md p-0.5" role="group" aria-label="Affichage">
              @for (option of views; track option.value) {
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium"
                  [class.bg-background]="view() === option.value"
                  [class.shadow-sm]="view() === option.value"
                  [class.text-muted-foreground]="view() !== option.value"
                  [attr.aria-pressed]="view() === option.value"
                  (click)="view.set(option.value)"
                >
                  <ng-icon [name]="option.icon" aria-hidden="true" />
                  <span class="max-sm:sr-only">{{ option.label }}</span>
                </button>
              }
            </div>
          </div>

          <div [class]="view() === 'split' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'">
            @if (view() !== 'preview') {
              <div>
                <label for="note-content" class="sr-only">Contenu (Markdown)</label>
                <textarea
                  #editor
                  id="note-content"
                  class="bg-muted/30 focus-visible:ring-ring min-h-[60vh] w-full resize-y rounded-md border p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2"
                  placeholder="Écrivez en Markdown : # titre, **gras**, \`code\`, listes, blocs \`\`\`ts…"
                  spellcheck="true"
                  [value]="store.content()"
                  (input)="store.edit({ content: $any($event.target).value })"
                  (keydown)="onEditorKeydown($event)"
                ></textarea>
              </div>
            }
            @if (view() !== 'write') {
              <article
                class="prose prose-sm dark:prose-invert prose-pre:p-0 max-w-none min-w-0 rounded-md border p-4 sm:prose-base"
                aria-label="Aperçu"
              >
                @if (store.content().trim()) {
                  <div [innerHTML]="store.content() | markdown"></div>
                } @else {
                  <p class="text-muted-foreground italic">Rien à afficher pour l’instant.</p>
                }
              </article>
            }
          </div>
        </div>
      }
    }
  `,
})
export class NoteEditorPage {
  /** Paramètre de route :id, lié par withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly store = inject(NoteEditorStore);
  private readonly api = inject(NotesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly views = VIEWS;
  protected readonly formatActions = FORMAT_ACTIONS;
  protected readonly selectClasses = SELECT_CLASSES;
  protected readonly view = signal<EditorView>('split');

  protected readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly projects = toSignal(
    inject(ProjectsApi)
      .list({ limit: 100, sort: 'name:asc' })
      .pipe(
        map((page) => page.data),
        catchError(() => of([] as Project[])),
      ),
    { initialValue: [] as Project[] },
  );
  protected readonly tags = toSignal(
    inject(TagsApi)
      .list()
      .pipe(catchError(() => of([] as Tag[]))),
    { initialValue: [] as Tag[] },
  );
  protected readonly tagIds = computed(
    () => new Set(this.store.note()?.tags.map((tag) => tag.id) ?? []),
  );

  constructor() {
    this.store.load(this.id);

    // Note toute neuve : titre sélectionné, prêt à être remplacé.
    let focused = false;
    effect(() => {
      const note = this.store.note();
      const input = this.titleInput()?.nativeElement;
      if (focused || !note || !input) return;
      focused = true;
      if (note.title === UNTITLED_NOTE && !note.content) input.select();
    });
  }

  protected format(format: MarkdownFormat): void {
    const textarea = this.editor()?.nativeElement;
    if (!textarea) return;
    const edit = applyFormat(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
      format,
    );
    textarea.value = edit.text;
    this.store.edit({ content: edit.text });
    textarea.focus();
    textarea.setSelectionRange(edit.start, edit.end);
  }

  protected onEditorKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    const shortcuts: Record<string, MarkdownFormat> = { b: 'bold', i: 'italic' };
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      this.store.saveNow();
    } else if (shortcuts[key]) {
      event.preventDefault();
      this.format(shortcuts[key]);
    }
  }

  protected toggleTag(id: string): void {
    const ids = new Set(this.tagIds());
    if (!ids.delete(id)) ids.add(id);
    this.store.updateMeta({ tagIds: [...ids] });
  }

  protected warnIfUnsaved(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) event.preventDefault();
  }

  protected remove(): void {
    const note = this.store.note();
    if (!note) return;
    this.confirm
      .confirm({
        title: `Supprimer « ${this.store.title() || note.title} » ?`,
        description: 'La note sera supprimée définitivement.',
        confirmLabel: 'Supprimer',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(note.id)),
      )
      .subscribe({
        next: () => {
          this.store.discard();
          toast.success('Note supprimée');
          void this.router.navigate(['/notes']);
        },
        error: (error: unknown) => toast.error(apiErrorMessage(error)),
      });
  }
}
