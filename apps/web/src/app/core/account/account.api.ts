import { HttpClient, type HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ChangePasswordRequest, UpdateProfileRequest, User } from '@devmirror/api-client';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api-base-url';

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** Nom du fichier annoncé par l'API (Content-Disposition), sinon un nom par défaut. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1] ?? fallback;
}

/** Compte de l'utilisateur connecté : profil, avatar, mot de passe, export, suppression. */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly me = `${this.baseUrl}/users/me`;

  updateProfile(body: UpdateProfileRequest): Observable<User> {
    return this.http.patch<User>(this.me, body);
  }

  uploadAvatar(file: File): Observable<User> {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.post<User>(`${this.me}/avatar`, form);
  }

  removeAvatar(): Observable<void> {
    return this.http.delete<void>(`${this.me}/avatar`);
  }

  changePassword(body: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/change-password`, body);
  }

  exportData(): Observable<DownloadedFile> {
    return this.http.get(`${this.me}/export`, { observe: 'response', responseType: 'blob' }).pipe(
      map((response: HttpResponse<Blob>) => ({
        blob: response.body ?? new Blob([], { type: 'application/json' }),
        fileName: fileNameFrom(
          response.headers.get('Content-Disposition'),
          'devmirror-export.json',
        ),
      })),
    );
  }

  deleteAccount(password: string): Observable<void> {
    return this.http.delete<void>(this.me, { body: { password } });
  }
}
