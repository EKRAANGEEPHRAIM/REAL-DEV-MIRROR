import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { I18nTitleStrategy } from './i18n-title-strategy';
import { applyLanguage } from './language';
import { setLanguage } from './translate';

@Component({ template: '' })
class Empty {}

describe('I18nTitleStrategy', () => {
  afterEach(() => applyLanguage('fr', false));

  it('traduit le titre de la route et le met à jour quand la langue change', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'projects', title: 'titles.projects', component: Empty }]),
        { provide: TitleStrategy, useClass: I18nTitleStrategy },
      ],
    });
    const title = TestBed.inject(Title);

    await TestBed.inject(Router).navigateByUrl('/projects');
    expect(title.getTitle()).toBe('Projets · DevMirror');

    await setLanguage('en', false);
    TestBed.tick();
    expect(title.getTitle()).toBe('Projects · DevMirror');
  });
});
