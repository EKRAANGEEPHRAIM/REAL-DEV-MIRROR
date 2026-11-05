import type { Priority, ProjectStatus, TaskStatus } from '../generated/prisma/client.js';

/**
 * Données du compte de démo, construites relativement à `now` : le compte paraît toujours
 * actif, avec environ trois mois d'historique. Fonction pure et déterministe (aucun aléa) :
 * deux exécutions le même jour donnent les mêmes données. Les entrées d'activité suivent les
 * mêmes règles que les services (projet ou note créés, tâche terminée, jalon coché).
 */

export interface DemoTag {
  name: string;
  color: string | null;
}

export interface DemoProject {
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  color: string;
  tags: string[];
  createdAt: Date;
}

export interface DemoTask {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  completedAt: Date | null;
  project: string | null;
  position: number;
  subtasks: { title: string; done: boolean }[];
  createdAt: Date;
}

export interface DemoGoal {
  key: string;
  title: string;
  description: string | null;
  targetDate: Date | null;
  projects: string[];
  milestones: { title: string; doneAt: Date | null }[];
  createdAt: Date;
}

export interface DemoNote {
  title: string;
  content: string;
  pinned: boolean;
  project: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoData {
  user: { name: string; bio: string; createdAt: Date };
  tags: DemoTag[];
  projects: DemoProject[];
  tasks: DemoTask[];
  goals: DemoGoal[];
  notes: DemoNote[];
}

const DAY_MS = 86_400_000;

/** Instant à `days` jours de `now` (négatif = passé), à l'heure locale du serveur donnée. */
function at(now: Date, days: number, hour = 10, minute = 0): Date {
  const date = new Date(now.getTime() + days * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** Échéance : date seule, à minuit UTC, comme celles saisies dans l'application. */
function due(now: Date, days: number): Date {
  const date = new Date(now.getTime() + days * DAY_MS);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Tâches terminées, avec le nombre de jours écoulés depuis leur achèvement. */
const DONE_TASKS: [project: string, title: string, daysAgo: number][] = [
  ['devmirror', 'Initialiser le monorepo pnpm (API NestJS, front Angular)', 86],
  ['devmirror', 'Schéma Prisma : utilisateurs, projets, tâches', 84],
  ['devmirror', 'Authentification JWT avec refresh token en cookie httpOnly', 83],
  ['portfolio', 'Maquette de la page d’accueil', 79],
  ['devmirror', 'CRUD des projets avec filtres et pagination', 75],
  ['portfolio', 'Section projets avec captures', 74],
  ['devmirror', 'Tâches : liste, priorités et échéances', 66],
  ['portfolio', 'Formulaire de contact sans backend', 65],
  ['devmirror', 'Kanban avec glisser-déposer', 63],
  ['portfolio', 'Déploiement sur Vercel avec domaine personnalisé', 62],
  ['facturation', 'Modèle de données : clients, factures, lignes', 60],
  ['devmirror', 'Notes Markdown avec aperçu côte à côte', 53],
  ['facturation', 'Génération des factures en PDF', 50],
  ['devmirror', 'Recherche globale et palette Ctrl+K', 48],
  ['blog', 'Article : rotation des refresh tokens', 45],
  ['devmirror', 'Tableau de bord : tuiles et graphiques', 41],
  ['facturation', 'Numérotation légale des factures', 39],
  ['devmirror', 'Heatmap d’activité sur un an', 38],
  ['cli', 'Commande deploy pour Render et Vercel', 34],
  ['devmirror', 'Interface en français et en anglais', 31],
  ['facturation', 'Relances automatiques des impayés', 24],
  ['devmirror', 'Audit d’accessibilité avec axe-core', 22],
  ['blog', 'Article : Signals ou RxJS dans Angular', 20],
  ['devmirror', 'Tests Playwright du parcours principal', 17],
  ['facturation', 'Export comptable au format CSV', 13],
  ['devmirror', 'Logs Pino et identifiant de requête', 10],
  ['devmirror', 'Lazy loading et @defer : bundle initial à 500 ko', 6],
  ['facturation', 'Tableau des encaissements du mois', 4],
  ['devmirror', 'Seed du compte de démo', 2],
  ['portfolio', 'Mettre à jour la liste des compétences', 1],
];

/** Tâches ouvertes : [projet, titre, statut, priorité, échéance en jours (null = aucune)]. */
const OPEN_TASKS: [string | null, string, TaskStatus, Priority, number | null][] = [
  ['devmirror', 'Vérification de sécurité : CORS, cookies, secrets', 'IN_PROGRESS', 'HIGH', 1],
  ['devmirror', 'README avec captures et schéma d’architecture', 'TODO', 'MEDIUM', 5],
  ['devmirror', 'Mentions légales et politique de confidentialité', 'TODO', 'MEDIUM', 6],
  ['devmirror', 'Mesurer Lighthouse en production', 'IN_REVIEW', 'MEDIUM', 2],
  ['facturation', 'Paiement en ligne par Stripe', 'IN_PROGRESS', 'HIGH', 9],
  ['facturation', 'Gérer les avoirs', 'TODO', 'LOW', 20],
  ['facturation', 'Corriger l’arrondi de la TVA sur les remises', 'TODO', 'URGENT', -2],
  ['portfolio', 'Rédiger l’étude de cas DevMirror', 'IN_PROGRESS', 'HIGH', 3],
  ['portfolio', 'Compresser les images en AVIF', 'TODO', 'LOW', null],
  ['cli', 'Prise en charge de Fly.io', 'TODO', 'LOW', null],
  ['habitudes', 'Choisir entre Ionic et Capacitor seul', 'TODO', 'MEDIUM', 14],
  ['blog', 'Article : tests e2e contre une branche Neon', 'IN_REVIEW', 'MEDIUM', 4],
  ['blog', 'Article : bien découper un bundle Angular', 'TODO', 'MEDIUM', 12],
  [null, 'Renouveler le nom de domaine', 'TODO', 'HIGH', -1],
];

const SUBTASKS: Record<string, { title: string; done: boolean }[]> = {
  'Vérification de sécurité : CORS, cookies, secrets': [
    { title: 'Origines CORS de production', done: true },
    { title: 'Attributs des cookies', done: true },
    { title: 'Limitation de débit derrière le proxy', done: false },
    { title: 'Recherche de secrets dans l’historique Git', done: false },
  ],
  'Paiement en ligne par Stripe': [
    { title: 'Compte Stripe en mode test', done: true },
    { title: 'Webhook de confirmation', done: false },
    { title: 'Page de paiement réussi', done: false },
  ],
  'Rédiger l’étude de cas DevMirror': [
    { title: 'Problème et contraintes', done: true },
    { title: 'Choix techniques', done: true },
    { title: 'Résultats chiffrés', done: false },
  ],
  'Initialiser le monorepo pnpm (API NestJS, front Angular)': [
    { title: 'Workspace pnpm', done: true },
    { title: 'ESLint et Prettier partagés', done: true },
    { title: 'Husky et lint-staged', done: true },
  ],
};

export function buildDemoData(now: Date): DemoData {
  const projects: DemoProject[] = [
    {
      key: 'devmirror',
      name: 'DevMirror',
      description:
        'Gestion de projets pour développeurs : projets, tâches, objectifs, notes Markdown et tableau de bord.',
      status: 'IN_PROGRESS',
      techStack: ['Angular', 'NestJS', 'Prisma', 'PostgreSQL', 'Tailwind CSS'],
      repoUrl: 'https://example.com/devmirror',
      demoUrl: null,
      color: '#6366f1',
      tags: ['angular', 'nestjs', 'typescript'],
      createdAt: at(now, -88, 9),
    },
    {
      key: 'facturation',
      name: 'API de facturation',
      description:
        'API REST de facturation pour indépendants : factures PDF, relances, export comptable.',
      status: 'IN_PROGRESS',
      techStack: ['NestJS', 'PostgreSQL', 'Stripe'],
      repoUrl: null,
      demoUrl: null,
      color: '#22c55e',
      tags: ['nestjs', 'postgres'],
      createdAt: at(now, -60, 14),
    },
    {
      key: 'portfolio',
      name: 'Portfolio v3',
      description: 'Site personnel statique, rapide et accessible.',
      status: 'DONE',
      techStack: ['Astro', 'Tailwind CSS'],
      repoUrl: null,
      demoUrl: 'https://example.com',
      color: '#ec4899',
      tags: ['ux'],
      createdAt: at(now, -80, 18),
    },
    {
      key: 'cli',
      name: 'CLI de déploiement',
      description: 'Une commande pour déployer front et API sur les hébergeurs gratuits.',
      status: 'PAUSED',
      techStack: ['Node.js', 'TypeScript'],
      repoUrl: null,
      demoUrl: null,
      color: '#f97316',
      tags: ['devops', 'typescript'],
      createdAt: at(now, -40, 20),
    },
    {
      key: 'habitudes',
      name: 'Application de suivi d’habitudes',
      description: 'Idée : une app mobile minimaliste, hors ligne d’abord.',
      status: 'IDEA',
      techStack: ['Angular', 'Capacitor'],
      repoUrl: null,
      demoUrl: null,
      color: '#06b6d4',
      tags: ['angular', 'ux'],
      createdAt: at(now, -15, 21),
    },
    {
      key: 'blog',
      name: 'Blog technique',
      description: 'Articles sur ce que j’apprends en construisant mes projets.',
      status: 'IN_PROGRESS',
      techStack: ['Markdown', 'Astro'],
      repoUrl: null,
      demoUrl: null,
      color: '#8b5cf6',
      tags: ['typescript'],
      createdAt: at(now, -50, 19),
    },
  ];

  const positions = new Map<TaskStatus, number>();
  const nextPosition = (status: TaskStatus) => {
    const position = positions.get(status) ?? 0;
    positions.set(status, position + 1);
    return position;
  };

  const tasks: DemoTask[] = [
    ...DONE_TASKS.map(([project, title, daysAgo], index): DemoTask => ({
      title,
      description: null,
      status: 'DONE',
      priority: (['MEDIUM', 'HIGH', 'LOW', 'MEDIUM'] as const)[index % 4],
      dueDate: due(now, -daysAgo + 1),
      // Heure de fin variée, en journée : le graphique et la heatmap tombent sur le bon jour.
      completedAt: at(now, -daysAgo, 11 + (index % 8), (index * 7) % 60),
      project,
      position: nextPosition('DONE'),
      subtasks: SUBTASKS[title] ?? [],
      createdAt: at(now, -daysAgo - 4, 9),
    })),
    ...OPEN_TASKS.map(([project, title, status, priority, dueIn], index): DemoTask => ({
      title,
      description:
        status === 'IN_PROGRESS' ? 'En cours cette semaine ; voir la note associée.' : null,
      status,
      priority,
      dueDate: dueIn === null ? null : due(now, dueIn),
      completedAt: null,
      project,
      position: nextPosition(status),
      subtasks: SUBTASKS[title] ?? [],
      createdAt: at(now, -12 + (index % 10), 10),
    })),
  ];

  const goals: DemoGoal[] = [
    {
      key: 'freelance',
      title: 'Décrocher une première mission freelance',
      description: 'Avec DevMirror et le portfolio comme vitrine.',
      targetDate: due(now, 45),
      projects: ['devmirror', 'portfolio'],
      milestones: [
        { title: 'Mettre en ligne le portfolio', doneAt: at(now, -60, 17) },
        { title: 'Publier DevMirror en version 1.0', doneAt: null },
        { title: 'Écrire trois études de cas', doneAt: at(now, -9, 18) },
        { title: 'Contacter dix entreprises', doneAt: null },
      ],
      createdAt: at(now, -85, 8),
    },
    {
      key: 'aws',
      title: 'Certification AWS Cloud Practitioner',
      description: null,
      targetDate: due(now, -12),
      projects: [],
      milestones: [
        { title: 'Suivre le cours en ligne', doneAt: at(now, -40, 20) },
        { title: 'Réussir deux examens blancs', doneAt: at(now, -22, 21) },
        { title: 'Passer l’examen', doneAt: at(now, -14, 12) },
      ],
      createdAt: at(now, -70, 20),
    },
    {
      key: 'articles',
      title: 'Publier six articles techniques',
      description: 'Un article par projet terminé ou par piège rencontré.',
      targetDate: due(now, 90),
      projects: ['blog'],
      milestones: [
        { title: 'Rotation des refresh tokens', doneAt: at(now, -45, 22) },
        { title: 'Signals ou RxJS', doneAt: at(now, -17, 22) },
        { title: 'Tests e2e contre une branche Neon', doneAt: null },
        { title: 'Découper un bundle Angular', doneAt: null },
        { title: 'Accessibilité automatisée', doneAt: null },
        { title: 'Retour d’expérience DevMirror', doneAt: null },
      ],
      createdAt: at(now, -48, 19),
    },
  ];

  const notes: DemoNote[] = [
    {
      title: 'Rotation des refresh tokens',
      content: [
        'Chaque refresh token ne sert **qu’une fois** : le serveur en émet un nouveau à chaque appel.',
        '',
        '- Stocké dans un cookie `httpOnly`, `SameSite=Strict`',
        '- Haché en base (SHA-256), jamais en clair',
        '- Réutilisation détectée → toute la famille est révoquée',
        '',
        '```ts',
        'const session = await auth.rotate(refreshToken);',
        '```',
      ].join('\n'),
      pinned: true,
      project: 'devmirror',
      tags: ['nestjs'],
      createdAt: at(now, -78, 21),
      updatedAt: at(now, -3, 9),
    },
    {
      title: 'Checklist de mise en production',
      content: [
        'Avant chaque mise en production :',
        '',
        '1. CI verte (lint, tests unitaires, e2e)',
        '2. Migrations appliquées sur la branche de test',
        '3. Variables d’environnement vérifiées sur Render',
        '4. Lighthouse sur les pages publiques',
        '5. Parcours manuel : inscription, projet, tâche',
      ].join('\n'),
      pinned: true,
      project: null,
      tags: ['devops'],
      createdAt: at(now, -55, 18),
      updatedAt: at(now, -6, 18),
    },
    {
      title: 'Signals ou RxJS ?',
      content: [
        '- **Signals** pour l’état et les valeurs dérivées (`computed`)',
        '- **RxJS** pour les flux dans le temps : requêtes, debounce, annulation',
        '- `rxMethod` (NgRx Signals) fait le pont entre les deux',
      ].join('\n'),
      pinned: false,
      project: 'devmirror',
      tags: ['angular'],
      createdAt: at(now, -30, 22),
      updatedAt: at(now, -17, 22),
    },
    {
      title: 'Numérotation des factures',
      content: [
        'La numérotation doit être **continue et chronologique**, sans trou.',
        '',
        'Format retenu : `AAAA-NNNN`, séquence par année, réservée dans une transaction.',
      ].join('\n'),
      pinned: false,
      project: 'facturation',
      tags: ['postgres'],
      createdAt: at(now, -39, 15),
      updatedAt: at(now, -38, 16),
    },
    {
      title: 'Index Prisma : ce que j’ai appris',
      content: [
        'Postgres n’indexe pas les clés étrangères tout seul : un `ON DELETE SET NULL` sans index',
        'parcourt toute la table.',
        '',
        'Et une condition sur `colonne AT TIME ZONE …` ne peut pas utiliser l’index de la colonne :',
        'mieux vaut convertir la borne.',
      ].join('\n'),
      pinned: false,
      project: 'devmirror',
      tags: ['postgres'],
      createdAt: at(now, -6, 20),
      updatedAt: at(now, -5, 20),
    },
    {
      title: 'Idées pour l’app d’habitudes',
      content: [
        '- Une seule question par jour, une réponse en un geste',
        '- Hors ligne d’abord, synchronisation plus tard',
        '- Pas de notifications culpabilisantes',
      ].join('\n'),
      pinned: false,
      project: 'habitudes',
      tags: ['ux'],
      createdAt: at(now, -15, 21),
      updatedAt: at(now, -15, 21),
    },
    {
      title: 'Commandes Git utiles',
      content: [
        'Celles que je cherche encore à chaque fois :',
        '',
        '```bash',
        'git switch -c j38            # branche du jour',
        'git rebase -i origin/main    # nettoyer avant la PR',
        'git log --oneline --graph',
        '```',
      ].join('\n'),
      pinned: false,
      project: null,
      tags: [],
      createdAt: at(now, -70, 9),
      updatedAt: at(now, -70, 9),
    },
    {
      title: 'Plan de l’étude de cas',
      content: [
        '1. Le problème : des projets éparpillés entre plusieurs outils',
        '2. Les contraintes : hébergement gratuit, accessibilité, deux langues',
        '3. Les choix : NestJS, Angular, Neon',
        '4. Les résultats : bundle, Lighthouse, couverture de tests',
      ].join('\n'),
      pinned: false,
      project: 'portfolio',
      tags: ['ux'],
      createdAt: at(now, -9, 18),
      updatedAt: at(now, -1, 19),
    },
  ];

  return {
    user: {
      name: 'Camille Démo',
      bio: 'Développeuse full-stack (Angular, NestJS). Compte de démonstration de DevMirror.',
      createdAt: at(now, -90, 8),
    },
    tags: [
      { name: 'angular', color: '#ef4444' },
      { name: 'nestjs', color: '#ec4899' },
      { name: 'typescript', color: '#3b82f6' },
      { name: 'postgres', color: '#06b6d4' },
      { name: 'devops', color: '#f97316' },
      { name: 'ux', color: null },
    ],
    projects,
    tasks,
    goals,
    notes,
  };
}

/** Entrée d'activité, telle que les services l'enregistrent ; `ref` désigne l'élément créé. */
export interface DemoActivity {
  type: 'PROJECT_CREATED' | 'TASK_COMPLETED' | 'NOTE_CREATED' | 'MILESTONE_COMPLETED';
  entityType: 'PROJECT' | 'TASK' | 'NOTE' | 'MILESTONE';
  ref: { kind: 'project' | 'task' | 'note' | 'milestone'; index: number; sub?: number };
  createdAt: Date;
}

/** Activité déduite des données, dans l'ordre chronologique. */
export function demoActivity(data: DemoData): DemoActivity[] {
  const entries: DemoActivity[] = [
    ...data.projects.map((p, index): DemoActivity => ({
      type: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      ref: { kind: 'project', index },
      createdAt: p.createdAt,
    })),
    ...data.notes.map((n, index): DemoActivity => ({
      type: 'NOTE_CREATED',
      entityType: 'NOTE',
      ref: { kind: 'note', index },
      createdAt: n.createdAt,
    })),
    ...data.tasks.flatMap((t, index): DemoActivity[] =>
      t.completedAt
        ? [
            {
              type: 'TASK_COMPLETED',
              entityType: 'TASK',
              ref: { kind: 'task', index },
              createdAt: t.completedAt,
            },
          ]
        : [],
    ),
    ...data.goals.flatMap((g, index) =>
      g.milestones.flatMap((m, sub): DemoActivity[] =>
        m.doneAt
          ? [
              {
                type: 'MILESTONE_COMPLETED',
                entityType: 'MILESTONE',
                ref: { kind: 'milestone', index, sub },
                createdAt: m.doneAt,
              },
            ]
          : [],
      ),
    ),
  ];
  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
