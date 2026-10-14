import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHammer } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';

/** Page provisoire des fonctionnalités pas encore livrées ; `heading` et `day` viennent des données de route. */
@Component({
  selector: 'dm-coming-soon',
  imports: [NgIcon, HlmCardImports],
  providers: [provideIcons({ lucideHammer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-semibold tracking-tight">{{ heading() }}</h1>
    <section hlmCard class="max-w-xl">
      <div hlmCardHeader>
        <h2 hlmCardTitle class="flex items-center gap-2">
          <ng-icon name="lucideHammer" aria-hidden="true" />
          En construction
        </h2>
        <p hlmCardDescription>Cette section arrive au jour {{ day() }} du plan de développement.</p>
      </div>
    </section>
  `,
})
export class ComingSoon {
  readonly heading = input.required<string>();
  readonly day = input.required<string>();
}
