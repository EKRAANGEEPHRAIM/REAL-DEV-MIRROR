import { inject, Injectable } from '@angular/core';
import type { Task, TaskStatus } from '@devmirror/api-client';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import type { Observable } from 'rxjs';
import { type TaskDialogResult, type TaskFormContext, TaskFormDialog } from './task-form-dialog';

/** Ouvre le formulaire de tâche ; émet le résultat, ou undefined si la fenêtre est fermée. */
@Injectable({ providedIn: 'root' })
export class TaskDialogs {
  private readonly dialog = inject(HlmDialogService);

  open(
    task?: Task,
    options: { projectId?: string; status?: TaskStatus } = {},
  ): Observable<TaskDialogResult | undefined> {
    return this.dialog.open<TaskDialogResult, TaskFormContext>(TaskFormDialog, {
      context: { task, projectId: options.projectId, status: options.status },
      contentClass: 'sm:max-w-xl',
    }).closed$;
  }
}
