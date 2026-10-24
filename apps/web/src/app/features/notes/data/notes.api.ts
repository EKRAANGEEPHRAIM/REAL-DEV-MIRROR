import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateNoteRequest,
  Note,
  NoteListQuery,
  NoteSummary,
  Paginated,
  UpdateNoteRequest,
} from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';
import { toHttpParams } from '../../../core/http/query-params';

@Injectable({ providedIn: 'root' })
export class NotesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/notes`;

  list(query: NoteListQuery): Observable<Paginated<NoteSummary>> {
    return this.http.get<Paginated<NoteSummary>>(this.url, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<Note> {
    return this.http.get<Note>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(body: CreateNoteRequest): Observable<Note> {
    return this.http.post<Note>(this.url, body);
  }

  update(id: string, body: UpdateNoteRequest): Observable<Note> {
    return this.http.patch<Note>(`${this.url}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
