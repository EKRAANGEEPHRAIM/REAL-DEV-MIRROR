import { InjectionToken } from '@angular/core';

/**
 * Préfixe des appels à l'API. Relatif : en développement le proxy Angular le renvoie vers
 * localhost:3000, en production la réécriture Vercel vers Render. Le front et l'API partagent
 * ainsi la même origine, ce qui permet au cookie du refresh token d'être SameSite=Strict.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});
