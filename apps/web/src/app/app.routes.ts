import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { Shell } from './core/layout/shell';
import { AuthLayout } from './features/auth/auth-layout';

const comingSoon = () => import('./shared/pages/coming-soon').then((m) => m.ComingSoon);

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
        loadComponent: comingSoon,
        data: { heading: 'Tableau de bord', day: '28' },
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
        loadComponent: comingSoon,
        data: { heading: 'Détail du projet', day: '15' },
      },
      {
        path: 'tasks',
        title: 'Tâches · DevMirror',
        loadComponent: comingSoon,
        data: { heading: 'Tâches', day: '18' },
      },
      {
        path: 'goals',
        title: 'Objectifs · DevMirror',
        loadComponent: comingSoon,
        data: { heading: 'Objectifs', day: '22' },
      },
      {
        path: 'notes',
        title: 'Notes · DevMirror',
        loadComponent: comingSoon,
        data: { heading: 'Notes', day: '24' },
      },
      {
        path: 'settings',
        title: 'Paramètres · DevMirror',
        loadComponent: comingSoon,
        data: { heading: 'Paramètres', day: '32' },
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
