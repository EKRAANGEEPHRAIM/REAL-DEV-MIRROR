import { inject, Injectable } from '@angular/core';
import type { Goal } from '@devmirror/api-client';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import type { Observable } from 'rxjs';
import { type GoalDialogResult, type GoalFormContext, GoalFormDialog } from './goal-form-dialog';

/** Ouvre le formulaire d'objectif ; émet le résultat, ou undefined si rien n'a changé. */
@Injectable({ providedIn: 'root' })
export class GoalDialogs {
  private readonly dialog = inject(HlmDialogService);

  open(goal?: Goal): Observable<GoalDialogResult | undefined> {
    return this.dialog.open<GoalDialogResult, GoalFormContext>(GoalFormDialog, {
      context: { goal },
      contentClass: 'sm:max-w-xl',
    }).closed$;
  }
}
