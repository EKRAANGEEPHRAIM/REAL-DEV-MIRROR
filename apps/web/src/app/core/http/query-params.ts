import { HttpParams } from '@angular/common/http';

type QueryValue = string | number | boolean | null | undefined;

/** Paramètres de requête sans les valeurs vides (undefined, null, chaîne vide, false). */
export function toHttpParams(query: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params = params.set(key, String(value));
  }
  return params;
}
