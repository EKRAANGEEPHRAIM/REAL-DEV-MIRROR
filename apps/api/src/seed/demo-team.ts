import { type Priority, ProjectRole, type TaskStatus } from '../generated/prisma/client.js';

/**
 * Équipe fictive autour du compte de démo, pour que la collaboration se voie dès la connexion :
 * des coéquipiers sur deux projets de Camille, un projet d'une coéquipière partagé avec elle,
 * des tâches écrites par d'autres et une invitation en attente.
 *
 * Les coéquipiers n'ont pas de mot de passe utilisable (empreinte d'un secret aléatoire jeté) :
 * personne ne peut se connecter à leur place. Leurs adresses sont sur un sous-domaine fictif.
 * Fonction pure et déterministe, comme `buildDemoData`.
 */

export const DEMO_TEAM_DOMAIN = 'equipe.demo.devmirror.dev';

export interface DemoTeammate {
  key: string;
  email: string;
  name: string;
  bio: string;
  createdAt: Date;
}

export interface DemoMembership {
  /** Projet du compte de démo (clé de `buildDemoData`) */
  project: string;
  teammate: string;
  role: ProjectRole;
  joinedAt: Date;
}

export interface DemoTeamTask {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  /** Clé d'un coéquipier, ou `demo` pour Camille */
  author: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface DemoSharedProject {
  owner: string;
  name: string;
  description: string;
  techStack: string[];
  color: string;
  createdAt: Date;
  /** Rôle de Camille sur ce projet */
  demoRole: ProjectRole;
  members: { teammate: string; role: ProjectRole }[];
  tasks: DemoTeamTask[];
}

export interface DemoTeam {
  teammates: DemoTeammate[];
  memberships: DemoMembership[];
  /** Tâches écrites par des coéquipiers dans les projets de Camille */
  contributions: (DemoTeamTask & { project: string })[];
  sharedProject: DemoSharedProject;
  pendingInvitation: { project: string; email: string; role: ProjectRole; createdAt: Date };
}

const DAY_MS = 86_400_000;
const at = (now: Date, days: number, hour = 10): Date => {
  const date = new Date(now.getTime() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};
const email = (local: string) => `${local}@${DEMO_TEAM_DOMAIN}`;

export function buildDemoTeam(now: Date): DemoTeam {
  return {
    teammates: [
      {
        key: 'awa',
        email: email('awa.kone'),
        name: 'Awa Koné',
        bio: 'Designer produit et intégratrice Angular, Abidjan.',
        createdAt: at(now, -80, 9),
      },
      {
        key: 'yann',
        email: email('yann.kouassi'),
        name: 'Yann Kouassi',
        bio: 'Développeur backend NestJS, passionné de bases de données.',
        createdAt: at(now, -75, 11),
      },
      {
        key: 'fatou',
        email: email('fatou.diallo'),
        name: 'Fatou Diallo',
        bio: 'Développeuse full-stack, paiements et facturation.',
        createdAt: at(now, -60, 14),
      },
    ],
    memberships: [
      { project: 'devmirror', teammate: 'awa', role: ProjectRole.EDITOR, joinedAt: at(now, -40) },
      { project: 'devmirror', teammate: 'yann', role: ProjectRole.VIEWER, joinedAt: at(now, -21) },
      {
        project: 'facturation',
        teammate: 'fatou',
        role: ProjectRole.EDITOR,
        joinedAt: at(now, -33),
      },
    ],
    contributions: [
      {
        project: 'devmirror',
        title: 'Maquettes de l’écran Équipe',
        description:
          'Liste des membres, rôles et invitations en attente, du mobile au grand écran.',
        status: 'DONE',
        priority: 'HIGH',
        author: 'awa',
        dueDate: at(now, -12),
        completedAt: at(now, -13, 16),
        createdAt: at(now, -20),
      },
      {
        project: 'devmirror',
        title: 'Relire l’accessibilité du Kanban au clavier',
        description: 'Ordre de tabulation, annonces du lecteur d’écran pendant le déplacement.',
        status: 'IN_REVIEW',
        priority: 'MEDIUM',
        author: 'awa',
        dueDate: at(now, 3),
        completedAt: null,
        createdAt: at(now, -6),
      },
      {
        project: 'facturation',
        title: 'Brancher les paiements Mobile Money',
        description: 'Orange Money, MTN MoMo et Wave ; webhook de confirmation idempotent.',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        author: 'fatou',
        dueDate: at(now, 5),
        completedAt: null,
        createdAt: at(now, -9),
      },
    ],
    sharedProject: {
      owner: 'awa',
      name: 'Design system Kente',
      description:
        'Bibliothèque de composants Angular accessibles, partagée par l’équipe : jetons de couleur, typographie, formulaires.',
      techStack: ['Angular', 'Tailwind CSS', 'Storybook'],
      color: '#d97706',
      createdAt: at(now, -50, 10),
      demoRole: ProjectRole.EDITOR,
      members: [{ teammate: 'yann', role: ProjectRole.VIEWER }],
      tasks: [
        {
          title: 'Jetons de couleur clair et sombre',
          description: null,
          status: 'DONE',
          priority: 'HIGH',
          author: 'awa',
          dueDate: null,
          completedAt: at(now, -30, 17),
          createdAt: at(now, -48),
        },
        {
          title: 'Composant Bouton : variantes et états',
          description: null,
          status: 'DONE',
          priority: 'MEDIUM',
          author: 'demo',
          dueDate: null,
          completedAt: at(now, -18, 15),
          createdAt: at(now, -35),
        },
        {
          title: 'Champs de formulaire avec messages d’erreur',
          description: 'Libellés liés, aria-describedby, erreurs annoncées au lecteur d’écran.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          author: 'demo',
          dueDate: at(now, 4),
          completedAt: null,
          createdAt: at(now, -10),
        },
        {
          title: 'Documenter les composants dans Storybook',
          description: null,
          status: 'TODO',
          priority: 'MEDIUM',
          author: 'awa',
          dueDate: at(now, 12),
          completedAt: null,
          createdAt: at(now, -7),
        },
        {
          title: 'Tests visuels de régression',
          description: null,
          status: 'TODO',
          priority: 'LOW',
          author: 'awa',
          dueDate: null,
          completedAt: null,
          createdAt: at(now, -3),
        },
      ],
    },
    pendingInvitation: {
      project: 'devmirror',
      email: email('moussa.traore'),
      role: ProjectRole.EDITOR,
      createdAt: at(now, -1, 18),
    },
  };
}
