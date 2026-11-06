import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { currentLanguage } from '../../core/i18n/language';
import { LanguageSwitcher } from '../../core/i18n/language-switcher';
import { translate } from '../../core/i18n/translate';

const REPOSITORY = 'https://github.com/EKRAANGEEPHRAIM/REAL-DEV-MIRROR';
const AUTHOR = 'https://github.com/EKRAANGEEPHRAIM';

/**
 * Mentions légales et politique de confidentialité (LCEN, RGPD). Page publique, sans compte.
 * Texte long, propre à cette page : écrit ici dans les deux langues plutôt que dans les
 * dictionnaires de l'interface.
 */
@Component({
  selector: 'dm-legal-page',
  imports: [RouterLink, LanguageSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="bg-background text-foreground min-h-dvh">
      <header class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <a routerLink="/" class="font-semibold">DevMirror</a>
        <dm-language-switcher />
      </header>
      <main
        class="mx-auto max-w-3xl px-4 pt-4 pb-16 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:ps-5"
      >
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('titles.legal') }}</h1>
        @if (language() === 'en') {
          <p class="text-muted-foreground">Last updated: November 2026.</p>

          <h2>Publisher</h2>
          <p>
            DevMirror is a personal, non-commercial project (portfolio) published by Ange Ephraim
            Ekra, who is also responsible for its content. Contact: through
            <a [href]="author" target="_blank" rel="noopener">GitHub</a>. Source code:
            <a [href]="repository" target="_blank" rel="noopener">public repository</a>.
          </p>

          <h2>Hosting</h2>
          <ul>
            <li>
              Web application: Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United
              States (vercel.com).
            </li>
            <li>
              API: Render Services, Inc., San Francisco, California, United States (render.com);
              servers in Frankfurt, Germany.
            </li>
            <li>
              Database: Neon, LLC (Databricks group), 160 Spear Street, Suite 1300, San Francisco,
              CA 94105, United States (neon.com); data stored in the London region (AWS eu-west-2).
            </li>
          </ul>

          <h2>Personal data</h2>
          <p>
            DevMirror only processes the data needed to provide the service, on the basis of the
            contract formed when you create an account (GDPR, art. 6(1)(b)):
          </p>
          <ul>
            <li>
              account: name, email address, password (stored hashed with bcrypt, never in clear);
            </li>
            <li>optional profile: bio, links, profile picture;</li>
            <li>
              your content: projects, tasks, goals, notes, tags, and the activity log they generate;
            </li>
            <li>preferences: theme and language.</li>
          </ul>
          <p>
            No advertising, no resale, no analytics or third-party trackers. Data is kept for as
            long as your account exists and is erased immediately and permanently when you delete
            it. Sessions expire after 7 days.
          </p>
          <p>
            Processors: Vercel, Render and Neon (hosting), Cloudinary (profile pictures), Resend
            (transactional emails). Some are based in the United States; transfers rely on the
            safeguards provided by the GDPR (EU-U.S. Data Privacy Framework or standard contractual
            clauses).
          </p>
          <p>
            Your rights: access and portability (Settings › Export my data), rectification (Settings
            › Profile), erasure (Settings › Delete account). For any other request, contact the
            publisher. You may lodge a complaint with the CNIL (cnil.fr).
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            A single cookie, strictly necessary: the session cookie (<code>dm_refresh</code>), not
            readable by scripts, valid 7 days. The browser's local storage keeps your theme, your
            language and whether a session was opened. None of this tracks you, so no consent banner
            is needed.
          </p>

          <h2>Demo account</h2>
          <p>
            The demo account is shared by all visitors and reset regularly: do not enter any
            personal information in it.
          </p>
        } @else {
          <p class="text-muted-foreground">Dernière mise à jour : novembre 2026.</p>

          <h2>Éditeur</h2>
          <p>
            DevMirror est un projet personnel et non commercial (portfolio), édité par Ange Ephraim
            Ekra, également directeur de la publication. Contact : via
            <a [href]="author" target="_blank" rel="noopener">GitHub</a>. Code source :
            <a [href]="repository" target="_blank" rel="noopener">dépôt public</a>.
          </p>

          <h2>Hébergement</h2>
          <ul>
            <li>
              Application web : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723,
              États-Unis (vercel.com).
            </li>
            <li>
              API : Render Services, Inc., San Francisco, Californie, États-Unis (render.com) ;
              serveurs à Francfort, Allemagne.
            </li>
            <li>
              Base de données : Neon, LLC (groupe Databricks), 160 Spear Street, Suite 1300, San
              Francisco, CA 94105, États-Unis (neon.com) ; données stockées dans la région de
              Londres (AWS eu-west-2).
            </li>
          </ul>

          <h2>Données personnelles</h2>
          <p>
            DevMirror ne traite que les données nécessaires au service, sur la base du contrat formé
            à la création du compte (RGPD, art. 6.1.b) :
          </p>
          <ul>
            <li>
              compte : nom, adresse email, mot de passe (stocké haché avec bcrypt, jamais en clair)
              ;
            </li>
            <li>profil facultatif : bio, liens, photo ;</li>
            <li>
              vos contenus : projets, tâches, objectifs, notes, tags, et le journal d'activité
              qu'ils produisent ;
            </li>
            <li>préférences : thème et langue.</li>
          </ul>
          <p>
            Ni publicité, ni revente, ni outil de mesure d'audience ou traceur tiers. Les données
            sont conservées tant que le compte existe, et effacées immédiatement et définitivement à
            sa suppression. Les sessions expirent au bout de 7 jours.
          </p>
          <p>
            Sous-traitants : Vercel, Render et Neon (hébergement), Cloudinary (photos de profil),
            Resend (emails transactionnels). Certains sont établis aux États-Unis ; les transferts
            reposent sur les garanties prévues par le RGPD (Data Privacy Framework UE–États-Unis ou
            clauses contractuelles types).
          </p>
          <p>
            Vos droits : accès et portabilité (Paramètres › Exporter mes données), rectification
            (Paramètres › Profil), effacement (Paramètres › Supprimer le compte). Pour toute autre
            demande, contactez l'éditeur. Vous pouvez adresser une réclamation à la CNIL (cnil.fr).
          </p>

          <h2>Cookies et stockage local</h2>
          <p>
            Un seul cookie, strictement nécessaire : le cookie de session (<code>dm_refresh</code>),
            illisible par les scripts, valable 7 jours. Le stockage local du navigateur garde votre
            thème, votre langue et l'indication qu'une session a été ouverte. Rien de cela ne sert à
            vous suivre : aucun bandeau de consentement n'est nécessaire.
          </p>

          <h2>Compte de démo</h2>
          <p>
            Le compte de démo est partagé par tous les visiteurs et remis à zéro régulièrement : n'y
            saisissez aucune information personnelle.
          </p>
        }
      </main>
    </div>
  `,
})
export class LegalPage {
  protected readonly t = translate;
  protected readonly language = currentLanguage;
  protected readonly repository = REPOSITORY;
  protected readonly author = AUTHOR;
}
