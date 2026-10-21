import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateProjectRequest,
  Paginated,
  Project,
  ProjectListQuery,
  UpdateProjectRequest,
} from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';
import { toHttpParams } from '../../../core/http/query-params';

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/projects`;

  list(query: ProjectListQuery): Observable<Paginated<Project>> {
    return this.http.get<Paginated<Project>>(this.url, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(body: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(this.url, body);
  }

  update(id: string, body: UpdateProjectRequest): Observable<Project> {
    return this.http.patch<Project>(`${this.url}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
