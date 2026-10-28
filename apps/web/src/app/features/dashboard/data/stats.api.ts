import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ActivityCalendar, StatsOverview } from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';

/** Fuseau IANA du navigateur : l'API y compte « cette semaine » et les jours actifs. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/stats`;

  overview(tz = browserTimeZone()): Observable<StatsOverview> {
    return this.http.get<StatsOverview>(`${this.url}/overview`, { params: { tz } });
  }

  activity(tz = browserTimeZone()): Observable<ActivityCalendar> {
    return this.http.get<ActivityCalendar>(`${this.url}/activity`, { params: { tz } });
  }
}
