import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  const store = {
    error: signal<string | null>(null),
    pending: signal(false),
    login: vi.fn(),
    clearError: vi.fn(),
  };

  async function render(returnUrl?: string) {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthStore, useValue: store }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginPage);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    store.error.set(null);
    store.pending.set(false);
  });

  it('efface une ancienne erreur à l’ouverture', async () => {
    await render();
    expect(store.clearError).toHaveBeenCalled();
  });

  it('n’appelle pas l’API et affiche les erreurs si le formulaire est invalide', async () => {
    const { fixture, element } = await render();

    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(store.login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Saisissez une adresse email valide.');
  });

  it('envoie les identifiants et la page de retour', async () => {
    const { element } = await render('/projects');

    type(element, '#email', 'ada@devmirror.dev');
    type(element, '#password', 'MotDePasse2026');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(store.login).toHaveBeenCalledWith({
      credentials: { email: 'ada@devmirror.dev', password: 'MotDePasse2026' },
      returnUrl: '/projects',
    });
  });

  it('affiche l’erreur du store et désactive le bouton pendant l’envoi', async () => {
    const { fixture, element } = await render();

    store.error.set('Email ou mot de passe incorrect');
    store.pending.set(true);
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Email ou mot de passe incorrect',
    );
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });
});
