import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { Tag } from '@devmirror/api-client';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideTags,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { filter, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { TagColorPicker } from './tag-color-picker';
import { TagsStore } from './tags.store';

/** Même normalisation que l'API : espaces superflus retirés, minuscules. */
export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** « 2 projets · 1 note », « Inutilisé ». */
export function tagUsageLabel(tag: Tag): string {
  const parts = [];
  if (tag.usage.projects) parts.push(plural(tag.usage.projects, 'projet', 'projets'));
  if (tag.usage.notes) parts.push(plural(tag.usage.notes, 'note', 'notes'));
  return parts.length ? parts.join(' · ') : 'Inutilisé';
}

interface Editing {
  id: string;
  name: string;
  color: string | null;
}

/** Créer, renommer, recolorer et supprimer ses tags (partagés par projets et notes). */
@Component({
  selector: 'dm-tags-settings',
  imports: [
    NgIcon,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSkeletonImports,
    FormAlert,
    TagColorPicker,
  ],
  providers: [
    TagsStore,
    provideIcons({ lucidePencil, lucidePlus, lucideRefreshCw, lucideTags, lucideTrash2 }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="tags-heading" class="rounded-xl border p-5">
      <h2 id="tags-heading" class="flex items-center gap-2 text-lg font-semibold">
        <ng-icon name="lucideTags" aria-hidden="true" />
        Tags
      </h2>
      <p class="text-muted-foreground mt-1 text-sm">
        Partagés par vos projets et vos notes. Les noms sont enregistrés en minuscules.
      </p>

      <form class="mt-4 flex flex-col gap-3" (submit)="$event.preventDefault(); create()">
        <div class="flex flex-col gap-2 sm:flex-row">
          <label hlmLabel for="new-tag" class="sr-only">Nom du nouveau tag</label>
          <input
            hlmInput
            id="new-tag"
            class="flex-1"
            placeholder="Nouveau tag, par ex. angular"
            maxlength="30"
            [value]="newName()"
            (input)="newName.set($any($event.target).value)"
          />
          <button hlmBtn type="submit" [disabled]="!newName().trim() || creating()">
            <ng-icon name="lucidePlus" aria-hidden="true" />
            Ajouter
          </button>
        </div>
        <dm-tag-color-picker
          label="Couleur du nouveau tag"
          [value]="newColor()"
          (changed)="newColor.set($event)"
        />
        @if (createError(); as message) {
          <dm-form-alert>{{ message }}</dm-form-alert>
        }
      </form>

      <div class="mt-6">
        @switch (store.status()) {
          @case ('error') {
            <div class="flex flex-col items-start gap-3">
              <dm-form-alert>{{ store.error() }}</dm-form-alert>
              <button hlmBtn variant="outline" size="sm" (click)="store.load()">
                <ng-icon name="lucideRefreshCw" aria-hidden="true" />
                Réessayer
              </button>
            </div>
          }
          @case ('loaded') {
            @if (store.sorted().length) {
              <ul class="divide-y rounded-md border" aria-label="Vos tags">
                @for (tag of store.sorted(); track tag.id) {
                  <li class="flex flex-col gap-3 px-3 py-2.5">
                    @if (editing()?.id === tag.id) {
                      @let edit = editing()!;
                      <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); save()">
                        <div class="flex flex-col gap-2 sm:flex-row">
                          <label hlmLabel [for]="'tag-name-' + tag.id" class="sr-only"
                            >Nom du tag</label
                          >
                          <input
                            hlmInput
                            class="flex-1"
                            maxlength="30"
                            [id]="'tag-name-' + tag.id"
                            [value]="edit.name"
                            (input)="setEditName($any($event.target).value)"
                            (keydown.escape)="cancelEdit()"
                          />
                          <div class="flex gap-2">
                            <button hlmBtn type="submit" size="sm" [disabled]="!edit.name.trim()">
                              Enregistrer
                            </button>
                            <button
                              hlmBtn
                              type="button"
                              variant="ghost"
                              size="sm"
                              (click)="cancelEdit()"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                        <dm-tag-color-picker
                          [label]="'Couleur de ' + tag.name"
                          [value]="edit.color"
                          (changed)="setEditColor($event)"
                        />
                        @if (editError(); as message) {
                          <dm-form-alert>{{ message }}</dm-form-alert>
                        }
                      </form>
                    } @else {
                      <div class="flex items-center gap-3">
                        <span
                          class="size-3 shrink-0 rounded-full border"
                          [style.background-color]="tag.color"
                          aria-hidden="true"
                        ></span>
                        <span class="min-w-0 flex-1 truncate font-medium">#{{ tag.name }}</span>
                        <span class="text-muted-foreground hidden text-xs sm:inline">{{
                          usage(tag)
                        }}</span>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="icon-sm"
                          [attr.aria-label]="'Modifier le tag ' + tag.name"
                          (click)="startEdit(tag)"
                        >
                          <ng-icon name="lucidePencil" aria-hidden="true" />
                        </button>
                        <button
                          hlmBtn
                          variant="ghost"
                          size="icon-sm"
                          class="text-destructive"
                          [attr.aria-label]="'Supprimer le tag ' + tag.name"
                          (click)="remove(tag)"
                        >
                          <ng-icon name="lucideTrash2" aria-hidden="true" />
                        </button>
                      </div>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p
                class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
              >
                Aucun tag pour l’instant. Créez-en pour classer vos projets et vos notes.
              </p>
            }
          }
          @default {
            <div class="flex flex-col gap-2" aria-busy="true" aria-label="Chargement des tags">
              @for (i of [1, 2, 3]; track i) {
                <hlm-skeleton class="h-10 w-full" />
              }
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class TagsSettings {
  protected readonly store = inject(TagsStore);
  private readonly confirm = inject(ConfirmService);

  protected readonly newName = signal('');
  protected readonly newColor = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly editing = signal<Editing | null>(null);
  protected readonly editError = signal<string | null>(null);

  constructor() {
    this.store.load();
  }

  protected usage(tag: Tag): string {
    return tagUsageLabel(tag);
  }

  protected create(): void {
    const name = normalizeTagName(this.newName());
    if (!name) return;
    this.creating.set(true);
    this.createError.set(null);
    this.store.create({ name, color: this.newColor() }).subscribe({
      next: (tag) => {
        this.creating.set(false);
        this.newName.set('');
        this.newColor.set(null);
        toast.success(`Tag « ${tag.name} » créé`);
      },
      error: (error: unknown) => {
        this.creating.set(false);
        this.createError.set(apiErrorMessage(error));
      },
    });
  }

  protected startEdit(tag: Tag): void {
    this.editError.set(null);
    this.editing.set({ id: tag.id, name: tag.name, color: tag.color });
  }

  protected setEditName(name: string): void {
    this.editing.update((edit) => (edit ? { ...edit, name } : edit));
  }

  protected setEditColor(color: string | null): void {
    this.editing.update((edit) => (edit ? { ...edit, color } : edit));
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected save(): void {
    const edit = this.editing();
    if (!edit) return;
    const name = normalizeTagName(edit.name);
    if (!name) return;
    this.editError.set(null);
    this.store.update(edit.id, { name, color: edit.color }).subscribe({
      next: () => {
        this.editing.set(null);
        toast.success('Tag enregistré');
      },
      error: (error: unknown) => this.editError.set(apiErrorMessage(error)),
    });
  }

  protected remove(tag: Tag): void {
    const used = tag.usage.projects + tag.usage.notes > 0;
    this.confirm
      .confirm({
        title: `Supprimer le tag « ${tag.name} » ?`,
        description: used
          ? `Il sera retiré de ${tagUsageLabel(tag)}, qui ne seront pas supprimés.`
          : 'Ce tag n’est utilisé nulle part.',
        confirmLabel: 'Supprimer',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.remove(tag.id)),
      )
      .subscribe({
        next: () => toast.success(`Tag « ${tag.name} » supprimé`),
        error: (error: unknown) => toast.error(apiErrorMessage(error)),
      });
  }
}
