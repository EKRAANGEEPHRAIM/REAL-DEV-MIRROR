import type {
  ActivityCalendar,
  AuthResponse,
  Goal,
  Note,
  NoteSummary,
  Paginated,
  Project,
  SearchResults,
  StatsOverview,
  Tag,
  Task,
  User,
} from '@devmirror/api-client';
import type { Page, Route } from '@playwright/test';

/** Jour (AAAA-MM-JJ) décalé de `offset` jours par rapport à aujourd'hui. */
function day(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const iso = (offset = 0) => `${day(offset)}T09:00:00.000Z`;

const user: User = {
  id: 'user-1',
  email: 'ada@devmirror.dev',
  name: 'Ada Lovelace',
  avatarUrl: null,
  bio: 'Développeuse full-stack, Angular et NestJS.',
  links: { github: 'https://github.com/ada', linkedin: null, website: null },
  preferences: { theme: 'light', language: 'fr' },
  emailVerified: true,
  createdAt: iso(-60),
};

const tags: Tag[] = [
  { id: 'tag-1', name: 'angular', color: '#ef4444', usage: { projects: 2, notes: 1 } },
  { id: 'tag-2', name: 'nestjs', color: '#22c55e', usage: { projects: 1, notes: 2 } },
  { id: 'tag-3', name: 'portfolio', color: null, usage: { projects: 0, notes: 0 } },
];
const tagRef = (tag: Tag) => ({ id: tag.id, name: tag.name, color: tag.color });

const projects: Project[] = [
  {
    id: 'p1',
    name: 'DevMirror',
    description: 'Plateforme de gestion de projets pour développeurs, avec tableau de bord.',
    status: 'IN_PROGRESS',
    techStack: ['Angular', 'NestJS', 'Prisma', 'PostgreSQL'],
    repoUrl: 'https://github.com/ada/devmirror',
    demoUrl: 'https://devmirror.dev',
    color: '#6366f1',
    tags: [tagRef(tags[0]), tagRef(tags[1])],
    progress: { total: 4, done: 1, percent: 25 },
    createdAt: iso(-30),
    updatedAt: iso(-1),
  },
  {
    id: 'p2',
    name: 'Bibliothèque de composants accessibles avec un nom particulièrement long',
    description: null,
    status: 'IDEA',
    techStack: [],
    repoUrl: null,
    demoUrl: null,
    color: '#ec4899',
    tags: [tagRef(tags[0])],
    progress: { total: 0, done: 0, percent: 0 },
    createdAt: iso(-12),
    updatedAt: iso(-5),
  },
  {
    id: 'p3',
    name: 'CLI de déploiement',
    description: 'Outil en ligne de commande pour Render et Vercel.',
    status: 'DONE',
    techStack: ['Node.js', 'TypeScript'],
    repoUrl: null,
    demoUrl: null,
    color: null,
    tags: [],
    progress: { total: 3, done: 3, percent: 100 },
    createdAt: iso(-50),
    updatedAt: iso(-20),
  },
];
const projectRef = (project: Project) => ({
  id: project.id,
  name: project.name,
  color: project.color,
});

const tasks: Task[] = [
  {
    id: 't1',
    title: 'Écrire les tests Playwright du parcours principal',
    description: 'Inscription, projet, tâche, tableau de bord.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: day(1),
    position: 0,
    completedAt: null,
    project: projectRef(projects[0]),
    subtasks: [
      { id: 's1', title: 'Configurer Playwright', done: true, position: 0 },
      { id: 's2', title: 'Parcours inscription', done: false, position: 1 },
    ],
    createdAt: iso(-6),
    updatedAt: iso(-1),
  },
  {
    id: 't2',
    title: 'Corriger le débordement du Kanban sur mobile',
    description: null,
    status: 'TODO',
    priority: 'URGENT',
    dueDate: day(-2),
    position: 0,
    completedAt: null,
    project: projectRef(projects[0]),
    subtasks: [],
    createdAt: iso(-8),
    updatedAt: iso(-3),
  },
  {
    id: 't3',
    title: 'Relire la documentation',
    description: null,
    status: 'IN_REVIEW',
    priority: 'LOW',
    dueDate: null,
    position: 0,
    completedAt: null,
    project: null,
    subtasks: [],
    createdAt: iso(-4),
    updatedAt: iso(-2),
  },
  {
    id: 't4',
    title: 'Publier la release semaine-6',
    description: null,
    status: 'DONE',
    priority: 'MEDIUM',
    dueDate: day(-1),
    position: 0,
    completedAt: iso(-1),
    project: projectRef(projects[2]),
    subtasks: [],
    createdAt: iso(-9),
    updatedAt: iso(-1),
  },
];

const goals: Goal[] = [
  {
    id: 'g1',
    title: 'Décrocher une première mission freelance',
    description: 'Avec DevMirror en vitrine.',
    targetDate: day(45),
    milestones: [
      { id: 'm1', title: 'Mettre à jour le portfolio', done: true, position: 0 },
      { id: 'm2', title: 'Écrire trois études de cas', done: false, position: 1 },
      { id: 'm3', title: 'Contacter dix entreprises', done: false, position: 2 },
      { id: 'm4', title: 'Préparer un devis type', done: false, position: 3 },
    ],
    projects: [projectRef(projects[0])],
    progress: { total: 4, done: 1, percent: 25 },
    completed: false,
    createdAt: iso(-20),
    updatedAt: iso(-2),
  },
  {
    id: 'g2',
    title: 'Certification Angular',
    description: null,
    targetDate: day(-3),
    milestones: [{ id: 'm5', title: 'Passer l’examen blanc', done: true, position: 0 }],
    projects: [],
    progress: { total: 1, done: 1, percent: 100 },
    completed: true,
    createdAt: iso(-40),
    updatedAt: iso(-3),
  },
];

const note: Note = {
  id: 'n1',
  title: 'Pièges du refresh JWT',
  excerpt: 'Un refresh token ne sert qu’une fois : la rotation détecte la réutilisation.',
  content:
    '# Rotation des refresh tokens\n\nUn refresh token ne sert **qu’une fois**.\n\n```ts\nconst token = await rotate(old);\n```\n\n- Détection de réutilisation\n- Révocation de la famille',
  pinned: true,
  project: projectRef(projects[0]),
  tags: [tagRef(tags[1])],
  createdAt: iso(-10),
  updatedAt: iso(-1),
};
const summary = (n: Note): NoteSummary => ({
  id: n.id,
  title: n.title,
  excerpt: n.excerpt,
  pinned: n.pinned,
  project: n.project,
  tags: n.tags,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});
const notes: NoteSummary[] = [
  summary(note),
  {
    id: 'n2',
    title: 'Signals vs RxJS',
    excerpt: 'rxMethod pour les effets, computed pour les dérivés.',
    pinned: false,
    project: null,
    tags: [tagRef(tags[0])],
    createdAt: iso(-7),
    updatedAt: iso(-4),
  },
];

function activity(): ActivityCalendar {
  const days = Array.from({ length: 120 }, (_, i) => ({
    date: day(-i * 3),
    count: (i * 7) % 6,
  })).filter((d) => d.count > 0);
  return {
    from: day(-364),
    to: day(0),
    total: days.reduce((sum, d) => sum + d.count, 0),
    days,
  };
}

function overview(): StatsOverview {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - 7 * (11 - i));
    return {
      weekStart: start.toISOString().slice(0, 10),
      count: [2, 4, 1, 0, 3, 5, 2, 6, 3, 4, 2, 3][i],
    };
  });
  return {
    timeZone: 'Europe/Paris',
    today: day(0),
    indicators: {
      activeProjects: 1,
      openTasks: 3,
      tasksCompletedThisWeek: 3,
      overdueTasks: 1,
      activeGoals: 1,
      completedGoals: 1,
      notes: 2,
      currentStreak: 4,
      longestStreak: 12,
    },
    tasksCompletedPerWeek: weeks,
    projectsByStatus: [
      { status: 'IDEA', count: 1 },
      { status: 'IN_PROGRESS', count: 1 },
      { status: 'PAUSED', count: 0 },
      { status: 'DONE', count: 1 },
      { status: 'ARCHIVED', count: 0 },
    ],
    dueSoon: tasks
      .filter((t) => t.dueDate && t.status !== 'DONE' && t.dueDate >= day(0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate!,
        status: t.status,
        priority: t.priority,
        project: t.project,
      })),
    recentNotes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: n.excerpt,
      pinned: n.pinned,
      updatedAt: n.updatedAt,
    })),
    activity: activity(),
  };
}

function paginated<T>(data: T[], limit = 12): Paginated<T> {
  return { data, meta: { total: data.length, page: 1, limit, totalPages: 1 } };
}

const session = (theme: User['preferences']['theme']): AuthResponse => ({
  accessToken: 'jwt-e2e',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { ...user, preferences: { ...user.preferences, theme } },
});

export interface MockOptions {
  /** Session ouverte au démarrage (refresh accepté) ; sinon les pages publiques s'affichent. */
  authenticated?: boolean;
  /** Listes vides, pour voir les états vides. */
  empty?: boolean;
  /** Thème enregistré dans le compte. */
  theme?: User['preferences']['theme'];
}

/** Simule l'API dans le navigateur : chaque appel à /api/v1 reçoit une réponse de démonstration. */
export async function mockApi(page: Page, options: MockOptions = {}): Promise<void> {
  const { authenticated = true, empty = false, theme = 'light' } = options;
  const list = <T>(items: T[]) => (empty ? [] : items);

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/refresh') {
      return authenticated
        ? json(session(theme))
        : json({ statusCode: 401, message: 'Session expirée' }, 401);
    }
    if (path.startsWith('/auth/')) return json(session(theme));
    if (path === '/users/me')
      return method === 'GET' || method === 'PATCH'
        ? json(session(theme).user)
        : route.fulfill({ status: 204 });

    if (method !== 'GET') return json({});

    if (path === '/projects') return json(paginated(list(projects)));
    if (path.startsWith('/projects/'))
      return json(projects.find((p) => path.endsWith(p.id)) ?? projects[0]);
    if (path === '/tasks') {
      const projectId = new URL(request.url()).searchParams.get('projectId');
      const status = new URL(request.url()).searchParams.get('status');
      return json(
        paginated(
          list(tasks).filter(
            (t) => (!projectId || t.project?.id === projectId) && (!status || t.status === status),
          ),
          25,
        ),
      );
    }
    if (path === '/goals') return json(paginated(list(goals)));
    if (path === '/notes') return json(paginated(list(notes), 24));
    if (path.startsWith('/notes/')) return json(note);
    if (path === '/tags') return json(list(tags));
    if (path === '/stats/overview') {
      const stats = overview();
      return json(
        empty
          ? {
              ...stats,
              indicators: {
                ...stats.indicators,
                activeProjects: 0,
                openTasks: 0,
                overdueTasks: 0,
                activeGoals: 0,
                completedGoals: 0,
                notes: 0,
                tasksCompletedThisWeek: 0,
                currentStreak: 0,
                longestStreak: 0,
              },
              tasksCompletedPerWeek: stats.tasksCompletedPerWeek.map((w) => ({ ...w, count: 0 })),
              projectsByStatus: stats.projectsByStatus.map((s) => ({ ...s, count: 0 })),
              dueSoon: [],
              recentNotes: [],
              activity: { ...stats.activity, total: 0, days: [] },
            }
          : stats,
      );
    }
    if (path === '/stats/activity')
      return json(empty ? { ...activity(), total: 0, days: [] } : activity());
    if (path === '/search') {
      const results: SearchResults = { q: '', projects: [], tasks: [], notes: [] };
      return json(results);
    }
    return json({ statusCode: 404, message: 'Introuvable' }, 404);
  });
}
