import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountSettings } from './account/account-settings';
import { PreferencesSettings } from './preferences/preferences-settings';
import { ProfileSettings } from './profile/profile-settings';
import { PasswordSettings } from './security/password-settings';
import { TagsSettings } from './tags/tags-settings';
import { translate } from '../../core/i18n/translate';

/** Paramètres du compte : profil, sécurité, préférences, tags, données. */
@Component({
  selector: 'dm-settings-page',
  imports: [
    RouterLink,
    ProfileSettings,
    PasswordSettings,
    PreferencesSettings,
    TagsSettings,
    AccountSettings,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('titles.settings') }}</h1>
      <p class="text-muted-foreground mt-1 text-sm">{{ t('settings.subtitle') }}</p>
    </header>
    <div class="flex max-w-3xl flex-col gap-6">
      <dm-profile-settings />
      <dm-password-settings />
      <dm-preferences-settings />
      <dm-tags-settings />
      <dm-account-settings />
      <a routerLink="/legal" class="text-muted-foreground text-sm hover:underline">{{
        t('layout.legal')
      }}</a>
    </div>
  `,
})
export class SettingsPage {
  protected readonly t = translate;
}
