import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { currentLanguage } from './language';
import { type TranslationKey, translate } from './translate';

/**
 * Le `title` d'une route est une clé de traduction (« titles.projects ») : l'onglet affiche
 * « Projets · DevMirror », et se met à jour quand la langue change.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private key: TranslationKey | null = null;

  constructor() {
    super();
    effect(() => {
      currentLanguage();
      if (this.key) this.apply(this.key);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key = (this.buildTitle(snapshot) as TranslationKey | undefined) ?? null;
    if (this.key) this.apply(this.key);
  }

  private apply(key: TranslationKey): void {
    this.title.setTitle(`${translate(key)} · ${translate('common.appName')}`);
  }
}
