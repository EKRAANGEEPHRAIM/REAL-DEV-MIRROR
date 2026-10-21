import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Project } from '@devmirror/api-client';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { ProjectsApi } from './projects.api';

interface ProjectDetailState {
  project: Project | null;
  status: 'loading' | 'loaded' | 'not-found' | 'error';
  error: string | null;
}

/** État de la page de détail ; fourni par le composant, il vit et meurt avec la page. */
export const ProjectDetailStore = signalStore(
  withState<ProjectDetailState>({ project: null, status: 'loading', error: null }),
  withMethods((store, api = inject(ProjectsApi)) => ({
    load: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap((id) =>
          api.get(id).pipe(
            tapResponse({
              next: (project) => patchState(store, { project, status: 'loaded' }),
              error: (error) =>
                error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
                  ? patchState(store, { project: null, status: 'not-found' })
                  : patchState(store, { status: 'error', error: apiErrorMessage(error) }),
            }),
          ),
        ),
      ),
    ),
    /** Projet renvoyé par l'API après une modification. */
    setProject: (project: Project) => patchState(store, { project, status: 'loaded' }),
  })),
);
