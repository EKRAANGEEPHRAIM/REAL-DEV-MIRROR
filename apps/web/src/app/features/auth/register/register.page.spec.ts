import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  const store = {
    error: signal<string | null>(null),
    pending: signal(false),
    register: vi.fn(),
    clearError: vi.fn(),
  };

  async function render() {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), { provide: AuthStore, useValue: store }],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegisterPage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function type(element: HTMLElement, selector: string, value: string) {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => vi.clearAllMocks());

  it('coche les règles du mot de passe au fil de la saisie', async () => {
    const { fixture, element } = await render();

    type(element, '#password', 'motdepasse');
    await fixture.whenStable();

    const rules = Array.from(element.querySelectorAll('dm-password-checklist li')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rules).toEqual([
      'Entre 8 et 72 caractères (respectée)',
      'Au moins une lettre (respectée)',
      'Au moins un chiffre (non respectée)',
    ]);
  });

  it('n’envoie rien tant que le mot de passe ne respecte pas les règles', async () => {
    const { element } = await render();

    type(element, '#name', 'Ada Lovelace');
    type(element, '#email', 'ada@devmirror.dev');
    type(element, '#password', 'motdepasse');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(store.register).not.toHaveBeenCalled();
  });

  it('crée le compte avec un formulaire valide', async () => {
    const { element } = await render();

    type(element, '#name', '  Ada Lovelace ');
    type(element, '#email', 'ada@devmirror.dev');
    type(element, '#password', 'MotDePasse2026');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(store.register).toHaveBeenCalledWith({
      credentials: { name: 'Ada Lovelace', email: 'ada@devmirror.dev', password: 'MotDePasse2026' },
      returnUrl: undefined,
    });
  });
});
