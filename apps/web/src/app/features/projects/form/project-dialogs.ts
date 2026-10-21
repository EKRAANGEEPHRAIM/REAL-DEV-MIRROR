import { inject, Injectable } from '@angular/core';
import type { Project } from '@devmirror/api-client';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { filter, type Observable } from 'rxjs';
import { type ProjectFormContext, ProjectFormDialog } from './project-form-dialog';

/** Ouvre le formulaire de projet ; émet le projet enregistré (rien si l'utilisateur annule). */
@Injectable({ providedIn: 'root' })
export class ProjectDialogs {
  private readonly dialog = inject(HlmDialogService);

  open(project?: Project): Observable<Project> {
    return this.dialog
      .open<Project, ProjectFormContext>(ProjectFormDialog, {
        context: { project },
        contentClass: 'sm:max-w-xl',
      })
      .closed$.pipe(filter((saved): saved is Project => !!saved));
  }
}
