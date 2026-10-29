import { DIALOG_DATA } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { User } from '@devmirror/api-client';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { of } from 'rxjs';
import { sessionResponse } from '../../../testing/auth-fixtures';
import { fileNameFrom } from '../../core/account/account.api';
import { AuthStore } from '../../core/auth/auth.store';
import { AccountSettings } from './account/account-settings';
import { DeleteAccountDialog } from './account/delete-account-dialog';
import { avatarFileError, ProfileSettings } from './profile/profile-settings';
import { PasswordSettings } from './security/password-settings';

describe('Paramètres du compte', () => {
  let backend: HttpTestingController;
  const user = signal<User | null>(null);
  const auth = {
    user,
    initials: signal('AL'),
    setUser: vi.fn((next: User) => user.set(next)),
    clearSession: vi.fn(),
  };
  const close = vi.fn();
  const dialogRef = new Proxy({ close } as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
  });
  const dialogs = { open: vi.fn() };

  async function render<T>(component: Type<T>) {
    vi.clearAllMocks();
    user.set({
      ...sessionResponse().user,
      bio: 'Développeuse',
      links: { github: 'https://github.com/ada', linkedin: null, website: null },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
        { provide: BrnDialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: {} },
        { provide: HlmDialogService, useValue: dialogs },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  const submit = (element: HTMLElement) =>
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  const button = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  afterEach(() => backend.verify());

  describe('profil', () => {
    it('pré-remplit et enregistre : espaces retirés, champs vides -> null', async () => {
      const { fixture, element } = await render(ProfileSettings);
      expect(element.querySelector<HTMLInputElement>('#profile-github')!.value).toBe(
        'https://github.com/ada',
      );

      type(element, '#profile-name', '  Ada King ');
      type(element, '#profile-bio', '   ');
      type(element, '#profile-github', '');
      type(element, '#profile-website', 'https://ada.dev');
      await fixture.whenStable();
      submit(element);

      const request = backend.expectOne((r) => r.method === 'PATCH');
      expect(request.request.body).toEqual({
        name: 'Ada King',
        bio: null,
        links: { github: null, linkedin: null, website: 'https://ada.dev' },
      });
      request.flush({ ...user()!, name: 'Ada King' });
      expect(auth.setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada King' }));
    });

    it('bloque un lien qui n’est pas une adresse http(s)', async () => {
      const { fixture, element } = await render(ProfileSettings);
      type(element, '#profile-website', 'ada.dev');
      await fixture.whenStable();
      submit(element);
      await fixture.whenStable();

      backend.expectNone((r) => r.method === 'PATCH');
      expect(element.textContent).toContain('Adresse http(s) attendue');
    });

    it('vérifie la photo avant l’envoi, puis l’envoie en multipart', async () => {
      expect(avatarFileError(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toContain(
        'Format non pris en charge',
      );
      const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
      expect(avatarFileError(big)).toBe('L’image dépasse 2 Mo.');

      const { element } = await render(ProfileSettings);
      const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
      const photo = new File(['png'], 'moi.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [photo] });
      input.dispatchEvent(new Event('change'));

      const request = backend.expectOne('/api/v1/users/me/avatar');
      expect(request.request.method).toBe('POST');
      expect((request.request.body as FormData).get('avatar')).toBe(photo);
      request.flush({ ...user()!, avatarUrl: 'https://res.cloudinary.com/a.webp' });
      expect(user()?.avatarUrl).toBe('https://res.cloudinary.com/a.webp');
    });
  });

  describe('mot de passe', () => {
    it('refuse une confirmation différente sans appeler l’API', async () => {
      const { fixture, element } = await render(PasswordSettings);
      type(element, '#current-password', 'Ancien2026');
      type(element, '#new-password', 'Nouveau2026');
      type(element, '#confirm-password', 'Autre2026');
      await fixture.whenStable();
      submit(element);
      await fixture.whenStable();

      backend.expectNone(() => true);
      expect(element.textContent).toContain('ne correspondent pas');
    });

    it('envoie le changement et affiche l’erreur de l’API', async () => {
      const { fixture, element } = await render(PasswordSettings);
      type(element, '#current-password', 'Mauvais2026');
      type(element, '#new-password', 'Nouveau2026');
      type(element, '#confirm-password', 'Nouveau2026');
      await fixture.whenStable();
      submit(element);

      const request = backend.expectOne('/api/v1/auth/change-password');
      expect(request.request.body).toEqual({
        currentPassword: 'Mauvais2026',
        newPassword: 'Nouveau2026',
      });
      request.flush(
        { message: 'Le mot de passe actuel est incorrect' },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();
      expect(element.textContent).toContain('Le mot de passe actuel est incorrect');
    });
  });

  describe('données et suppression', () => {
    it('lit le nom de fichier envoyé par l’API', () => {
      expect(
        fileNameFrom('attachment; filename="devmirror-export-2026-10-29.json"', 'défaut.json'),
      ).toBe('devmirror-export-2026-10-29.json');
      expect(fileNameFrom(null, 'défaut.json')).toBe('défaut.json');
    });

    it('télécharge l’export', async () => {
      const createObjectURL = vi.fn(() => 'blob:export');
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const { element } = await render(AccountSettings);

      button(element, 'Exporter mes données').click();
      backend.expectOne('/api/v1/users/me/export').flush(new Blob(['{}']), {
        headers: {
          'Content-Disposition': 'attachment; filename="devmirror-export-2026-10-29.json"',
        },
      });

      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
      click.mockRestore();
    });

    it('après suppression confirmée : session fermée, retour à la connexion', async () => {
      dialogs.open.mockReturnValue({ closed$: of(true) });
      const { element } = await render(AccountSettings);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      button(element, 'Supprimer mon compte').click();

      expect(dialogs.open).toHaveBeenCalledWith(DeleteAccountDialog, expect.anything());
      expect(auth.clearSession).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('la fenêtre de suppression exige le mot de passe et affiche un refus', async () => {
      const { fixture, element } = await render(DeleteAccountDialog);
      expect(button(element, 'Supprimer mon compte').disabled).toBe(true);

      type(element, '#delete-password', 'Mauvais2026');
      await fixture.whenStable();
      submit(element);
      const request = backend.expectOne((r) => r.method === 'DELETE');
      expect(request.request.body).toEqual({ password: 'Mauvais2026' });
      request.flush(
        { message: 'Le mot de passe actuel est incorrect' },
        { status: 400, statusText: 'KO' },
      );
      await fixture.whenStable();
      expect(element.textContent).toContain('Le mot de passe actuel est incorrect');
      expect(close).not.toHaveBeenCalled();

      submit(element);
      backend
        .expectOne((r) => r.method === 'DELETE')
        .flush(null, { status: 204, statusText: 'OK' });
      expect(close).toHaveBeenCalledWith(true);
    });
  });
});
