import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AccountSettings } from './account/account-settings';
import { PreferencesSettings } from './preferences/preferences-settings';
import { ProfileSettings } from './profile/profile-settings';
import { PasswordSettings } from './security/password-settings';
import { TagsSettings } from './tags/tags-settings';

/** Paramètres du compte : profil, sécurité, préférences, tags, données. */
@Component({
  selector: 'dm-settings-page',
  imports: [ProfileSettings, PasswordSettings, PreferencesSettings, TagsSettings, AccountSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p class="text-muted-foreground mt-1 text-sm">Votre profil, votre compte et vos données.</p>
    </header>
    <div class="flex max-w-3xl flex-col gap-6">
      <dm-profile-settings />
      <dm-password-settings />
      <dm-preferences-settings />
      <dm-tags-settings />
      <dm-account-settings />
    </div>
  `,
})
export class SettingsPage {}
