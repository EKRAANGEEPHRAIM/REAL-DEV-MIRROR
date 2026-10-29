import { computed, inject } from '@angular/core';
import type { CreateTagRequest, Tag, UpdateTagRequest } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { removeEntity, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { type Observable, pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { compareText } from '../../../core/i18n/format';
import { TagsApi } from '../../../shared/data/tags.api';

interface TagsState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
}

const byName = (a: Tag, b: Tag) => compareText(a.name, b.name);

/**
 * Tags de l'utilisateur pour la page Paramètres. Les mutations renvoient l'Observable de
 * l'API : le formulaire affiche lui-même l'erreur (nom déjà pris, couleur invalide…).
 */
export const TagsStore = signalStore(
  withEntities<Tag>(),
  withState<TagsState>({ status: 'idle', error: null }),
  withComputed(({ entities }) => ({
    sorted: computed(() => [...entities()].sort(byName)),
  })),
  withMethods((store, api = inject(TagsApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          api.list().pipe(
            tapResponse({
              next: (tags) => patchState(store, setAllEntities(tags), { status: 'loaded' }),
              error: (error) =>
                patchState(store, { status: 'error', error: apiErrorMessage(error) }),
            }),
          ),
        ),
      ),
    ),

    create(body: CreateTagRequest): Observable<Tag> {
      return api.create(body).pipe(tap((tag) => patchState(store, setEntity(tag))));
    },

    update(id: string, body: UpdateTagRequest): Observable<Tag> {
      return api.update(id, body).pipe(tap((tag) => patchState(store, setEntity(tag))));
    },

    remove(id: string): Observable<void> {
      return api.remove(id).pipe(tap(() => patchState(store, removeEntity(id))));
    },
  })),
);
