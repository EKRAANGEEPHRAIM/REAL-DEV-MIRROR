import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { applyLanguage } from '../../core/i18n/language';
import { setLanguage } from '../../core/i18n/translate';
import { LegalPage } from './legal.page';

describe('LegalPage', () => {
  afterEach(() => applyLanguage('fr', false));

  async function render() {
    await TestBed.configureTestingModule({
      imports: [LegalPage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(LegalPage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('présente éditeur, hébergeurs, données personnelles et cookies', async () => {
    const { element } = await render();
    const headings = Array.from(element.querySelectorAll('h2')).map((h) => h.textContent?.trim());

    expect(element.querySelector('h1')?.textContent).toContain('Mentions légales');
    expect(headings).toEqual([
      'Éditeur',
      'Hébergement',
      'Données personnelles',
      'Cookies et stockage local',
      'Compte de démo',
    ]);
    expect(element.textContent).toContain('Vercel Inc.');
    expect(element.textContent).toContain('Paramètres › Supprimer le compte');
  });

  it('suit la langue de l’interface', async () => {
    const { fixture, element } = await render();
    await setLanguage('en', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('h1')?.textContent).toContain('Legal notice');
    expect(element.textContent).toContain('Personal data');
  });
});
