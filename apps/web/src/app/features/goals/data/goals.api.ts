import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateGoalRequest,
  CreateMilestoneRequest,
  Goal,
  GoalListQuery,
  Milestone,
  Paginated,
  UpdateGoalRequest,
  UpdateMilestoneRequest,
} from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';
import { toHttpParams } from '../../../core/http/query-params';

@Injectable({ providedIn: 'root' })
export class GoalsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/goals`;

  list(query: GoalListQuery): Observable<Paginated<Goal>> {
    return this.http.get<Paginated<Goal>>(this.url, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<Goal> {
    return this.http.get<Goal>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(body: CreateGoalRequest): Observable<Goal> {
    return this.http.post<Goal>(this.url, body);
  }

  update(id: string, body: UpdateGoalRequest): Observable<Goal> {
    return this.http.patch<Goal>(`${this.url}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  addMilestone(goalId: string, body: CreateMilestoneRequest): Observable<Milestone> {
    return this.http.post<Milestone>(this.milestonesUrl(goalId), body);
  }

  updateMilestone(goalId: string, id: string, body: UpdateMilestoneRequest): Observable<Milestone> {
    return this.http.patch<Milestone>(
      `${this.milestonesUrl(goalId)}/${encodeURIComponent(id)}`,
      body,
    );
  }

  removeMilestone(goalId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.milestonesUrl(goalId)}/${encodeURIComponent(id)}`);
  }

  private milestonesUrl(goalId: string): string {
    return `${this.url}/${encodeURIComponent(goalId)}/milestones`;
  }
}
