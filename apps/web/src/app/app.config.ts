import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { I18nTitleStrategy } from './core/i18n/i18n-title-strategy';
import { storedLanguage } from './core/i18n/language';
import { setLanguage } from './core/i18n/translate';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: I18nTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideSpartanHlm(),
    // Langue mémorisée appliquée avant le premier rendu (dictionnaire anglais chargé si besoin).
    provideAppInitializer(() => setLanguage(storedLanguage() ?? 'fr', false)),
  ],
};
