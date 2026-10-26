import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TagsSettings } from './tags/tags-settings';

/** Paramètres du compte ; le profil et les préférences arrivent en J32. */
@Component({
  selector: 'dm-settings-page',
  imports: [TagsSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p class="text-muted-foreground mt-1 text-sm">Organisation de votre espace DevMirror.</p>
    </header>
    <div class="flex max-w-2xl flex-col gap-6">
      <dm-tags-settings />
    </div>
  `,
})
export class SettingsPage {}
