import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';

const comingSoon = () => import('./shared/pages/coming-soon').then((m) => m.ComingSoon);

export const routes: Routes = [
  {
    path: '',
    component: Shell,
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
        loadComponent: comingSoon,
        data: { heading: 'Projets', day: '14' },
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
  { path: '**', redirectTo: '' },
];
