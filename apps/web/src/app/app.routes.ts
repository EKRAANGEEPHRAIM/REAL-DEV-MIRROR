import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { Shell } from './core/layout/shell';
import { AuthLayout } from './features/auth/auth-layout';

// Ordre important : les deux layouts ont un chemin vide. Le shell vient en premier pour que
// « / » y soit résolu ; un layout à chemin vide sans enfant correspondant s'afficherait vide.
// title : clé de traduction, traduite par I18nTitleStrategy (« Projets · DevMirror »).
export const routes: Routes = [
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'titles.dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        title: 'titles.projects',
        loadComponent: () =>
          import('./features/projects/list/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/:id',
        title: 'titles.project',
        loadComponent: () =>
          import('./features/projects/detail/project-detail.page').then((m) => m.ProjectDetailPage),
      },
      {
        path: 'tasks',
        title: 'titles.tasks',
        loadComponent: () => import('./features/tasks/list/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'goals',
        title: 'titles.goals',
        loadComponent: () => import('./features/goals/list/goals.page').then((m) => m.GoalsPage),
      },
      {
        path: 'notes',
        title: 'titles.notes',
        loadComponent: () => import('./features/notes/list/notes.page').then((m) => m.NotesPage),
      },
      {
        path: 'notes/:id',
        title: 'titles.note',
        loadComponent: () =>
          import('./features/notes/editor/note-editor.page').then((m) => m.NoteEditorPage),
      },
      {
        path: 'settings',
        title: 'titles.settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        title: 'titles.login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'titles.register',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        title: 'titles.forgotPassword',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      // Liens reçus par email : accessibles même avec une session ouverte dans ce navigateur.
      {
        path: 'reset-password',
        title: 'titles.resetPassword',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
      {
        path: 'verify-email',
        title: 'titles.verifyEmail',
        loadComponent: () =>
          import('./features/auth/verify-email/verify-email.page').then((m) => m.VerifyEmailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
