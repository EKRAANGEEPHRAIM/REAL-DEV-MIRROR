import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { ForgotPasswordPage } from './forgot-password/forgot-password.page';
import { ResetPasswordPage } from './reset-password/reset-password.page';
import { VerifyEmailPage } from './verify-email/verify-email.page';

const TOKEN = 'q5Yw0bJt8vZr3mN1xKc7Ld2Pf9Hs4Ug6Ae0Wi3Ty5Ro';

describe('pages des liens envoyés par email', () => {
  let backend: HttpTestingController;
  const store = {
    isAuthenticated: () => false,
    clearSession: vi.fn(),
    markEmailVerified: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: store },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  describe('ForgotPasswordPage', () => {
    it('affiche la confirmation après l’envoi, sans révéler si le compte existe', async () => {
      const fixture = TestBed.createComponent(ForgotPasswordPage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      type(element, '#email', 'Ada@DevMirror.dev');
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      const request = backend.expectOne('/api/v1/auth/forgot-password');
      expect(request.request.body).toEqual({ email: 'Ada@DevMirror.dev' });
      request.flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();

      expect(element.textContent).toContain('Si un compte existe pour ada@devmirror.dev');
    });
  });

  describe('ResetPasswordPage', () => {
    it('sans jeton, propose de demander un nouveau lien', async () => {
      const fixture = TestBed.createComponent(ResetPasswordPage);
      await fixture.whenStable();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ce lien est incomplet');
    });

    it('enregistre le mot de passe, ferme la session locale et renvoie vers la connexion', async () => {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(ResetPasswordPage);
      fixture.componentRef.setInput('token', TOKEN);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      type(element, '#password', 'NouveauMotDePasse2026');
      type(element, '#confirm', 'NouveauMotDePasse2026');
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      const request = backend.expectOne('/api/v1/auth/reset-password');
      expect(request.request.body).toEqual({ token: TOKEN, password: 'NouveauMotDePasse2026' });
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.clearSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('refuse deux mots de passe différents sans appeler l’API', async () => {
      const fixture = TestBed.createComponent(ResetPasswordPage);
      fixture.componentRef.setInput('token', TOKEN);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      type(element, '#password', 'NouveauMotDePasse2026');
      type(element, '#confirm', 'Different2026');
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectNone('/api/v1/auth/reset-password');
      expect(element.textContent).toContain('Les deux mots de passe sont différents.');
    });
  });

  describe('VerifyEmailPage', () => {
    it('vérifie le lien à l’ouverture et met à jour la session', async () => {
      const fixture = TestBed.createComponent(VerifyEmailPage);
      fixture.componentRef.setInput('token', TOKEN);
      fixture.detectChanges();

      backend
        .expectOne('/api/v1/auth/verify-email')
        .flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(store.markEmailVerified).toHaveBeenCalled();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Adresse email confirmée',
      );
    });

    it('affiche le message de l’API pour un lien expiré', async () => {
      const fixture = TestBed.createComponent(VerifyEmailPage);
      fixture.componentRef.setInput('token', TOKEN);
      fixture.detectChanges();

      backend
        .expectOne('/api/v1/auth/verify-email')
        .flush({ message: 'Lien invalide ou expiré' }, { status: 400, statusText: 'Bad Request' });
      await fixture.whenStable();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Lien invalide ou expiré');
      expect(store.markEmailVerified).not.toHaveBeenCalled();
    });
  });
});
