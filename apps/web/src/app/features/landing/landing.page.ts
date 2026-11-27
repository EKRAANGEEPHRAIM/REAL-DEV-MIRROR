import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageSwitcher } from '../../core/i18n/language-switcher';
import { translate, type TranslationKey } from '../../core/i18n/translate';
import { Logo } from '../../core/layout/logo';
import { ThemeToggle } from '../../core/theme/theme-toggle';

interface Command {
  name: string;
  text: TranslationKey;
}

/**
 * Page publique de DevMirror (visiteurs non connectés) : ce que c'est, pour qui, et l'accès
 * direct à la démo. Identité « terminal ambré » : invites de commande, curseur, fenêtre de
 * terminal toujours sombre, même en thème clair.
 */
@Component({
  selector: 'dm-landing-page',
  imports: [RouterLink, Logo, LanguageSwitcher, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background text-foreground min-h-dvh">
      <header class="border-b">
        <div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:px-6">
          <a routerLink="/" class="me-auto flex items-center"><dm-logo /></a>
          <dm-language-switcher />
          @defer (on idle) {
            <dm-theme-toggle />
          } @placeholder {
            <span class="inline-block size-9" aria-hidden="true"></span>
          }
          <a routerLink="/login" class="hover:bg-muted hidden rounded px-3 py-2 text-sm sm:block">{{
            t('landing.login')
          }}</a>
        </div>
      </header>

      <main id="contenu">
        <!-- Accroche -->
        <section
          class="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20"
        >
          <div>
            <p class="dm-prompt text-muted-foreground text-sm">{{ t('landing.prompt') }}</p>
            <h1 class="dm-cursor mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
              {{ t('landing.title') }}
            </h1>
            <p class="text-muted-foreground mt-6 max-w-[60ch] leading-7">{{ t('landing.lead') }}</p>
            <div class="mt-8 flex flex-wrap items-center gap-3">
              <a
                routerLink="/login"
                [queryParams]="{ demo: 1 }"
                class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center rounded px-5 font-semibold"
                >{{ t('landing.tryDemo') }}</a
              >
              <a
                routerLink="/login"
                class="hover:bg-muted inline-flex min-h-11 items-center rounded border px-5 font-semibold"
                >{{ t('landing.login') }}</a
              >
            </div>
            <p class="text-muted-foreground mt-4 text-xs">{{ t('landing.demoHint') }}</p>
          </div>

          <!-- Fenêtre de terminal : toujours sombre, quel que soit le thème -->
          <figure
            class="overflow-hidden rounded border border-[#3a3226] bg-[#0f0d0a] text-[#f3e7cf] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.55)]"
            [attr.aria-label]="t('landing.terminal.label')"
          >
            <div
              class="flex items-center gap-2 border-b border-[#3a3226] px-4 py-2.5 text-xs text-[#b8a47f]"
            >
              <span class="size-2.5 rounded-full bg-[#ff7a66]" aria-hidden="true"></span>
              <span class="size-2.5 rounded-full bg-[#ffb000]" aria-hidden="true"></span>
              <span class="size-2.5 rounded-full bg-[#8fd16a]" aria-hidden="true"></span>
              <span class="ms-2">~/devmirror</span>
            </div>
            <div class="space-y-2 p-5 text-sm leading-6">
              <p><span class="text-[#ffb000]">$</span> {{ t('landing.terminal.status') }}</p>
              <p><span class="text-[#ffb000]">▸</span> {{ t('landing.terminal.projects') }}</p>
              <p><span class="text-[#8fd16a]">✓</span> {{ t('landing.terminal.done') }}</p>
              <p><span class="text-[#ffb000]">▸</span> {{ t('landing.terminal.viewer') }}</p>
              <p><span class="text-[#ffb000]">▸</span> {{ t('landing.terminal.invite') }}</p>
              <p class="dm-cursor"><span class="text-[#ffb000]">$</span></p>
            </div>
          </figure>
        </section>

        <!-- Commandes -->
        <section class="border-t">
          <div class="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <h2 class="dm-prompt text-xl font-bold sm:text-2xl">
              {{ t('landing.commandsTitle') }}
            </h2>
            <dl
              class="mt-8 grid gap-px overflow-hidden rounded border bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3"
            >
              @for (command of commands; track command.name) {
                <div class="bg-card p-5">
                  <dt class="text-primary font-semibold">devmirror {{ command.name }}</dt>
                  <dd class="text-muted-foreground mt-2 text-sm leading-6">
                    {{ t(command.text) }}
                  </dd>
                </div>
              }
            </dl>
          </div>
        </section>

        <!-- Sous le capot -->
        <section class="border-t">
          <div class="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1fr_1.4fr]">
            <h2 class="dm-prompt text-xl font-bold sm:text-2xl">{{ t('landing.stackTitle') }}</h2>
            <ul class="divide-y rounded border text-sm">
              @for (line of stack; track line.label) {
                <li class="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr]">
                  <span class="text-primary">{{ line.label }}</span>
                  <span>{{ t(line.text) }}</span>
                </li>
              }
            </ul>
          </div>
        </section>

        <!-- Appel à l'essai -->
        <section class="border-t">
          <div class="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <div class="rounded border-2 border-[var(--primary)] p-6 sm:p-10">
              <h2 class="text-xl font-bold sm:text-2xl">{{ t('landing.ctaTitle') }}</h2>
              <p class="text-muted-foreground mt-3 max-w-[60ch] leading-7">
                {{ t('landing.ctaText') }}
              </p>
              <a
                routerLink="/login"
                [queryParams]="{ demo: 1 }"
                class="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex min-h-11 items-center rounded px-5 font-semibold"
                >{{ t('landing.tryDemo') }}</a
              >
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t">
        <div
          class="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs md:px-6"
        >
          <span>{{ t('landing.madeBy') }}</span>
          <a routerLink="/legal" class="hover:underline">{{ t('layout.legal') }}</a>
        </div>
      </footer>
    </div>
  `,
})
export class LandingPage {
  protected readonly t = translate;

  protected readonly commands: Command[] = [
    { name: 'projects', text: 'landing.commands.projects' },
    { name: 'tasks', text: 'landing.commands.tasks' },
    { name: 'team', text: 'landing.commands.team' },
    { name: 'goals', text: 'landing.commands.goals' },
    { name: 'notes', text: 'landing.commands.notes' },
    { name: 'search', text: 'landing.commands.search' },
  ];

  protected readonly stack: { label: string; text: TranslationKey }[] = [
    { label: 'front', text: 'landing.stack.front' },
    { label: 'back', text: 'landing.stack.back' },
    { label: 'quality', text: 'landing.stack.quality' },
    { label: 'deploy', text: 'landing.stack.deploy' },
  ];
}
