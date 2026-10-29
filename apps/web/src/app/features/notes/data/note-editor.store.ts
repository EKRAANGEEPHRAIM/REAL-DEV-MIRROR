import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import type { Note } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toast } from '@spartan-ng/brain/sonner';
import { concatMap, debounce, EMPTY, filter, pipe, switchMap, tap, timer } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { NotesApi } from './notes.api';

/** Délai sans frappe avant la sauvegarde automatique. */
export const AUTOSAVE_DELAY = 1000;

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

/** Réglages enregistrés aussitôt (pas de brouillon). */
export interface NoteMetaChanges {
  pinned?: boolean;
  projectId?: string | null;
  tagIds?: string[];
}

interface Draft {
  title?: string;
  content?: string;
}

interface NoteEditorState {
  /** Dernière version connue du serveur. */
  note: Note | null;
  status: 'loading' | 'loaded' | 'not-found' | 'error';
  error: string | null;
  /** Valeurs affichées dans l'éditeur, en avance sur `note` tant qu'elles ne sont pas enregistrées. */
  title: string;
  content: string;
  save: SaveStatus;
  saveError: string | null;
  savedAt: string | null;
}

/**
 * Éditeur d'une note ; fourni par la page. Titre et contenu sont enregistrés après une
 * seconde sans frappe (rxMethod + debounce). Les modifications faites pendant un
 * enregistrement sont gardées pour le suivant (concatMap), et ce qui reste en attente en
 * quittant la page est envoyé tout de suite.
 */
export const NoteEditorStore = signalStore(
  withState<NoteEditorState>({
    note: null,
    status: 'loading',
    error: null,
    title: '',
    content: '',
    save: 'saved',
    saveError: null,
    savedAt: null,
  }),
  withComputed(({ title }) => ({
    titleInvalid: computed(() => !title().trim()),
  })),
  withMethods((store, api = inject(NotesApi)) => {
    /** Champs modifiés depuis le dernier envoi. */
    let dirty: Draft = {};
    /** Champs de l'envoi en cours (renvoyés en quittant la page si la requête est coupée). */
    let inflight: Draft = {};

    const noteId = () => store.note()?.id;

    /** Prend les champs à envoyer ; un titre vide reste en attente. */
    const takeDirty = (): Draft => {
      const body: Draft = {};
      const kept: Draft = {};
      if (dirty.content !== undefined) body.content = dirty.content;
      if (dirty.title !== undefined) {
        if (dirty.title.trim()) body.title = dirty.title.trim();
        else kept.title = dirty.title;
      }
      dirty = kept;
      return body;
    };

    const persist = rxMethod<'later' | 'now'>(
      pipe(
        debounce((when) => timer(when === 'now' ? 0 : AUTOSAVE_DELAY)),
        filter(() => !!noteId()),
        concatMap(() => {
          const body = takeDirty();
          if (body.title === undefined && body.content === undefined) {
            // Rien d'envoyable (titre vide) : on attend une correction.
            patchState(store, { save: dirty.title !== undefined ? 'pending' : 'saved' });
            return EMPTY;
          }
          inflight = body;
          patchState(store, { save: 'saving', saveError: null });
          return api.update(noteId()!, body).pipe(
            tapResponse({
              next: (note) => {
                inflight = {};
                patchState(store, {
                  note,
                  save: Object.keys(dirty).length ? 'pending' : 'saved',
                  savedAt: note.updatedAt,
                });
              },
              error: (error) => {
                // Les champs non enregistrés reviennent en attente, sous les plus récents.
                dirty = { ...inflight, ...dirty };
                inflight = {};
                patchState(store, { save: 'error', saveError: apiErrorMessage(error) });
              },
            }),
          );
        }),
      ),
    );

    return {
      load: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { status: 'loading', error: null })),
          switchMap((id) =>
            api.get(id).pipe(
              tapResponse({
                next: (note) => {
                  dirty = {};
                  patchState(store, {
                    note,
                    status: 'loaded',
                    title: note.title,
                    content: note.content,
                    save: 'saved',
                    saveError: null,
                    savedAt: note.updatedAt,
                  });
                },
                error: (error) =>
                  error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
                    ? patchState(store, { note: null, status: 'not-found' })
                    : patchState(store, { status: 'error', error: apiErrorMessage(error) }),
              }),
            ),
          ),
        ),
      ),

      /** Frappe dans le titre ou le contenu : affichage immédiat, envoi différé. */
      edit(changes: Draft): void {
        dirty = { ...dirty, ...changes };
        patchState(store, { ...changes, save: 'pending' });
        persist('later');
      },

      /** Ctrl+S, « Réessayer » : envoie tout de suite ce qui est en attente. */
      saveNow(): void {
        persist('now');
      },

      hasUnsavedChanges(): boolean {
        return Object.keys(dirty).length > 0 || Object.keys(inflight).length > 0;
      },

      /** Épinglage, projet, tags : enregistrés aussitôt, sans toucher au brouillon. */
      updateMeta(body: NoteMetaChanges): void {
        const id = noteId();
        if (!id) return;
        api.update(id, body).subscribe({
          next: (note) => patchState(store, { note, savedAt: note.updatedAt }),
          error: (error: unknown) => toast.error(apiErrorMessage(error)),
        });
      },

      /** Note supprimée : plus rien à enregistrer en quittant la page. */
      discard(): void {
        dirty = {};
        inflight = {};
      },

      /** Départ de la page : requête hors du cycle de vie du store, pour qu'elle aboutisse. */
      flushOnLeave(): void {
        const id = noteId();
        const body = { ...inflight, ...takeDirty() };
        if (!id || (body.title === undefined && body.content === undefined)) return;
        api.update(id, body).subscribe({
          error: () => toast.error(translate('notes.editor.leaveFailed')),
        });
      },
    };
  }),
  withHooks({
    onDestroy: (store) => store.flushOnLeave(),
  }),
);
