import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideExternalLink,
  lucideGithub,
  lucidePencil,
  lucideSearchX,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { filter, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/http/api-error';
import { RelativeTimePipe } from '../../../shared/format/relative-time';
import { ConfirmService } from '../../../shared/ui-kit/confirm-dialog';
import { FormAlert } from '../../../shared/ui-kit/form-alert';
import { ProjectDetailStore } from '../data/project-detail.store';
import { ProjectsApi } from '../data/projects.api';
import { ProjectDialogs } from '../form/project-dialogs';
import { projectStatus } from '../project-status';
import { ProjectTasks, type ProjectTasksView } from './project-tasks';

@Component({
  selector: 'dm-project-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmSkeletonImports,
    FormAlert,
    RelativeTimePipe,
    ProjectTasks,
  ],
  providers: [
    ProjectDetailStore,
    provideIcons({
      lucideArrowLeft,
      lucideExternalLink,
      lucideGithub,
      lucidePencil,
      lucideSearchX,
      lucideTrash2,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a hlmBtn variant="ghost" size="sm" routerLink="/projects" class="-ms-2 mb-4">
      <ng-icon name="lucideArrowLeft" aria-hidden="true" />
      Projets
    </a>

    @switch (store.status()) {
      @case ('loading') {
        <div class="flex flex-col gap-4" aria-busy="true" aria-label="Chargement du projet">
          <hlm-skeleton class="h-8 w-1/2" />
          <hlm-skeleton class="h-4 w-3/4" />
          <hlm-skeleton class="h-40 w-full" />
        </div>
      }
      @case ('not-found') {
        <section
          class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <ng-icon name="lucideSearchX" class="text-muted-foreground text-4xl" aria-hidden="true" />
          <h1 class="text-lg font-medium">Projet introuvable</h1>
          <p class="text-muted-foreground text-sm">Il a peut-être été supprimé.</p>
          <a hlmBtn variant="outline" routerLink="/projects">Retour aux projets</a>
        </section>
      }
      @case ('error') {
        <dm-form-alert class="max-w-xl">{{ store.error() }}</dm-form-alert>
      }
      @case ('loaded') {
        @if (store.project(); as project) {
          <header class="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex min-w-0 flex-col gap-2">
              <div class="flex flex-wrap items-center gap-3">
                <span
                  class="size-3 shrink-0 rounded-full"
                  [style.background-color]="project.color ?? 'var(--muted-foreground)'"
                  aria-hidden="true"
                ></span>
                <h1 class="text-2xl font-semibold tracking-tight break-words">
                  {{ project.name }}
                </h1>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="status().tone">
                  {{ status().label }}
                </span>
              </div>
              @if (project.description) {
                <p class="text-muted-foreground max-w-3xl whitespace-pre-line">
                  {{ project.description }}
                </p>
              }
            </div>
            <div class="flex shrink-0 gap-2">
              <button hlmBtn variant="outline" (click)="edit()">
                <ng-icon name="lucidePencil" aria-hidden="true" />
                Modifier
              </button>
              <button hlmBtn variant="outline" class="text-destructive" (click)="remove()">
                <ng-icon name="lucideTrash2" aria-hidden="true" />
                Supprimer
              </button>
            </div>
          </header>

          <div class="grid gap-4 lg:grid-cols-3">
            <!-- En Kanban, quatre colonnes ont besoin de toute la largeur. -->
            <dm-project-tasks
              class="lg:col-span-2"
              [class.lg:col-span-3]="tasksView() === 'board'"
              [projectId]="project.id"
              [view]="tasksView()"
              (viewChange)="setTasksView($event)"
            />

            <aside hlmCard aria-labelledby="info-title">
              <div hlmCardHeader>
                <h2 hlmCardTitle id="info-title">Informations</h2>
              </div>
              <dl hlmCardContent class="flex flex-col gap-4 text-sm">
                @if (project.repoUrl || project.demoUrl) {
                  <div class="flex flex-col gap-1">
                    <dt class="text-muted-foreground">Liens</dt>
                    <dd class="flex flex-col gap-1">
                      @if (project.repoUrl) {
                        <a
                          [href]="project.repoUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center gap-1.5 hover:underline"
                        >
                          <ng-icon name="lucideGithub" aria-hidden="true" />
                          Dépôt
                          <span class="sr-only">(nouvel onglet)</span>
                        </a>
                      }
                      @if (project.demoUrl) {
                        <a
                          [href]="project.demoUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center gap-1.5 hover:underline"
                        >
                          <ng-icon name="lucideExternalLink" aria-hidden="true" />
                          Démo
                          <span class="sr-only">(nouvel onglet)</span>
                        </a>
                      }
                    </dd>
                  </div>
                }
                @if (project.techStack.length) {
                  <div class="flex flex-col gap-1.5">
                    <dt class="text-muted-foreground">Technologies</dt>
                    <dd class="flex flex-wrap gap-1.5">
                      @for (tech of project.techStack; track tech) {
                        <span hlmBadge variant="secondary">{{ tech }}</span>
                      }
                    </dd>
                  </div>
                }
                @if (project.tags.length) {
                  <div class="flex flex-col gap-1.5">
                    <dt class="text-muted-foreground">Tags</dt>
                    <dd class="flex flex-wrap gap-1.5">
                      @for (tag of project.tags; track tag.id) {
                        <a
                          hlmBadge
                          variant="outline"
                          [routerLink]="['/projects']"
                          [queryParams]="{ tag: tag.name }"
                          >#{{ tag.name }}</a
                        >
                      }
                    </dd>
                  </div>
                }
                <div class="flex flex-col gap-1">
                  <dt class="text-muted-foreground">Créé le</dt>
                  <dd>{{ project.createdAt | date: 'longDate' }}</dd>
                </div>
                <div class="flex flex-col gap-1">
                  <dt class="text-muted-foreground">Dernière modification</dt>
                  <dd>{{ project.updatedAt | relativeTime }}</dd>
                </div>
              </dl>
            </aside>
          </div>
        }
      }
    }
  `,
})
export class ProjectDetailPage {
  /** Paramètre de route :id (withComponentInputBinding). */
  readonly id = input.required<string>();
  /** Affichage des tâches (?view=board), partageable comme sur la page des tâches. */
  readonly view = input<string>();

  protected readonly store = inject(ProjectDetailStore);
  private readonly api = inject(ProjectsApi);
  private readonly dialogs = inject(ProjectDialogs);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = computed(() => {
    const project = this.store.project();
    return projectStatus(project?.status ?? 'IDEA');
  });
  protected readonly tasksView = computed<ProjectTasksView>(() =>
    this.view() === 'board' ? 'board' : 'list',
  );

  constructor() {
    this.store.load(this.id);
  }

  protected setTasksView(view: ProjectTasksView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'board' ? 'board' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected edit(): void {
    const project = this.store.project();
    if (!project) return;
    this.dialogs.open(project).subscribe((saved) => {
      this.store.setProject(saved);
      toast.success('Projet enregistré');
    });
  }

  protected remove(): void {
    const project = this.store.project();
    if (!project) return;
    this.confirm
      .confirm({
        title: `Supprimer « ${project.name} » ?`,
        description:
          'Le projet et toutes ses tâches seront supprimés définitivement. Ses notes sont conservées.',
        confirmLabel: 'Supprimer',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(project.id)),
      )
      .subscribe({
        next: () => {
          toast.success('Projet supprimé');
          void this.router.navigateByUrl('/projects');
        },
        error: (error: unknown) => toast.error(apiErrorMessage(error)),
      });
  }
}
