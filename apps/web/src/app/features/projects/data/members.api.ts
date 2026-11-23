import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CreateInvitationRequest,
  ProjectInvitation,
  ProjectMember,
  UpdateMemberRequest,
} from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';

/** Équipe d'un projet : membres, rôles et invitations (gestion réservée au propriétaire). */
@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(projectId: string, path: string): string {
    return `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/${path}`;
  }

  members(projectId: string): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(this.url(projectId, 'members'));
  }

  updateMember(
    projectId: string,
    userId: string,
    body: UpdateMemberRequest,
  ): Observable<ProjectMember> {
    return this.http.patch<ProjectMember>(
      this.url(projectId, `members/${encodeURIComponent(userId)}`),
      body,
    );
  }

  /** Retirer un membre, ou quitter le projet avec son propre identifiant. */
  removeMember(projectId: string, userId: string): Observable<void> {
    return this.http.delete<void>(this.url(projectId, `members/${encodeURIComponent(userId)}`));
  }

  invitations(projectId: string): Observable<ProjectInvitation[]> {
    return this.http.get<ProjectInvitation[]>(this.url(projectId, 'invitations'));
  }

  invite(projectId: string, body: CreateInvitationRequest): Observable<ProjectInvitation> {
    return this.http.post<ProjectInvitation>(this.url(projectId, 'invitations'), body);
  }

  revoke(projectId: string, invitationId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(projectId, `invitations/${encodeURIComponent(invitationId)}`),
    );
  }
}
