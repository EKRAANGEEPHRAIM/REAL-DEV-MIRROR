import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateSubtaskRequest,
  CreateTaskRequest,
  Paginated,
  ReorderTasksRequest,
  Subtask,
  Task,
  TaskListQuery,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';
import { toHttpParams } from '../../../core/http/query-params';

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/tasks`;

  list(query: TaskListQuery): Observable<Paginated<Task>> {
    return this.http.get<Paginated<Task>>(this.url, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(body: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(this.url, body);
  }

  update(id: string, body: UpdateTaskRequest): Observable<Task> {
    return this.http.patch<Task>(`${this.url}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  reorder(body: ReorderTasksRequest): Observable<Task[]> {
    return this.http.patch<Task[]>(`${this.url}/reorder`, body);
  }

  addSubtask(taskId: string, body: CreateSubtaskRequest): Observable<Subtask> {
    return this.http.post<Subtask>(`${this.url}/${encodeURIComponent(taskId)}/subtasks`, body);
  }

  updateSubtask(taskId: string, id: string, body: UpdateSubtaskRequest): Observable<Subtask> {
    return this.http.patch<Subtask>(
      `${this.url}/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(id)}`,
      body,
    );
  }

  removeSubtask(taskId: string, id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(id)}`,
    );
  }
}
