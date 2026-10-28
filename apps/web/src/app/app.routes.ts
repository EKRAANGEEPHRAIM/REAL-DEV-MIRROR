import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { Shell } from './core/layout/shell';
import { AuthLayout } from './features/auth/auth-layout';

// Ordre important : les deux layouts ont un chemin vide. Le shell vient en premier pour que
// « / » y soit résolu ; un layout à chemin vide sans enfant correspondant s'afficherait vide.
export const routes: Routes = [
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Tableau de bord · DevMirror',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        title: 'Projets · DevMirror',
        loadComponent: () =>
          import('./features/projects/list/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/:id',
        title: 'Projet · DevMirror',
        loadComponent: () =>
          import('./features/projects/detail/project-detail.page').then((m) => m.ProjectDetailPage),
      },
      {
        path: 'tasks',
        title: 'Tâches · DevMirror',
        loadComponent: () => import('./features/tasks/list/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'goals',
        title: 'Objectifs · DevMirror',
        loadComponent: () => import('./features/goals/list/goals.page').then((m) => m.GoalsPage),
      },
      {
        path: 'notes',
        title: 'Notes · DevMirror',
        loadComponent: () => import('./features/notes/list/notes.page').then((m) => m.NotesPage),
      },
      {
        path: 'notes/:id',
        title: 'Note · DevMirror',
        loadComponent: () =>
          import('./features/notes/editor/note-editor.page').then((m) => m.NoteEditorPage),
      },
      {
        path: 'settings',
        title: 'Paramètres · DevMirror',
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
        title: 'Connexion · DevMirror',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Créer un compte · DevMirror',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        title: 'Mot de passe oublié · DevMirror',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      // Liens reçus par email : accessibles même avec une session ouverte dans ce navigateur.
      {
        path: 'reset-password',
        title: 'Nouveau mot de passe · DevMirror',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
      {
        path: 'verify-email',
        title: 'Vérification de l’email · DevMirror',
        loadComponent: () =>
          import('./features/auth/verify-email/verify-email.page').then((m) => m.VerifyEmailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
