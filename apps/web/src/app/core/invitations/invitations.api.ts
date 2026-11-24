import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AcceptedInvitation, ReceivedInvitation } from '@devmirror/api-client';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url';

/** Invitations reçues par l'utilisateur connecté. */
@Injectable({ providedIn: 'root' })
export class InvitationsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/invitations`;

  received(): Observable<ReceivedInvitation[]> {
    return this.http.get<ReceivedInvitation[]>(this.url);
  }

  /** Invitation ouverte depuis le lien de l'email. */
  preview(token: string): Observable<ReceivedInvitation> {
    return this.http.get<ReceivedInvitation>(`${this.url}/token/${encodeURIComponent(token)}`);
  }

  acceptByToken(token: string): Observable<AcceptedInvitation> {
    return this.http.post<AcceptedInvitation>(
      `${this.url}/token/${encodeURIComponent(token)}/accept`,
      {},
    );
  }

  /** Depuis l'application : l'adresse email du compte doit être vérifiée. */
  accept(id: string): Observable<AcceptedInvitation> {
    return this.http.post<AcceptedInvitation>(`${this.url}/${encodeURIComponent(id)}/accept`, {});
  }

  decline(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/decline`, {});
  }
}
