import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { SearchResults } from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url';
import { toHttpParams } from '../http/query-params';

@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/search`;

  search(q: string, limit = 5): Observable<SearchResults> {
    return this.http.get<SearchResults>(this.url, { params: toHttpParams({ q, limit }) });
  }
}
