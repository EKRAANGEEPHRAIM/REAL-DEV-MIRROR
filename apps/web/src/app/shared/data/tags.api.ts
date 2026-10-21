import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CreateTagRequest, Tag, UpdateTagRequest } from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/http/api-base-url';

/** Tags de l'utilisateur, partagés par les projets et les notes. */
@Injectable({ providedIn: 'root' })
export class TagsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/tags`;

  list(): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.url);
  }

  create(body: CreateTagRequest): Observable<Tag> {
    return this.http.post<Tag>(this.url, body);
  }

  update(id: string, body: UpdateTagRequest): Observable<Tag> {
    return this.http.patch<Tag>(`${this.url}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
