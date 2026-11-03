import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { User } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AvatarStorage } from './avatar-storage.js';
import { EXPORT_VERSION, ExportService } from './export.service.js';
import { ACCOUNT_NOT_FOUND, UsersService } from './users.service.js';

// Cloudinary simulé : on vérifie ce que le stockage lui demande, sans réseau.
const cloudinaryMock = vi.hoisted(() => ({
  config: vi.fn(),
  uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
}));
vi.mock('cloudinary', () => ({ v2: cloudinaryMock }));

const createdAt = new Date('2026-09-01T09:00:00Z');

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@devmirror.dev',
    name: 'Ada Lovelace',
    passwordHash: '$argon2id$secret',
    avatarUrl: null,
    bio: null,
    links: { github: 'https://github.com/ada' },
    preferences: { theme: 'dark', language: 'fr' },
    emailVerified: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  const service = new UsersService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

  it('cherche et crée les comptes avec un email normalisé et un nom nettoyé', async () => {
    await service.findByEmail('  Ada@DevMirror.DEV ');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@devmirror.dev' },
    });

    await service.create({ email: ' ADA@devmirror.dev', name: '  Ada  ', passwordHash: 'h' });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'ada@devmirror.dev', name: 'Ada', passwordHash: 'h' },
    });
  });

  it('met à jour vérification, mot de passe et avatar du bon compte', async () => {
    await service.findById('user-1');
    await service.markEmailVerified('user-1');
    await service.updatePassword('user-1', 'nouveau-hash');
    await service.setAvatar('user-1', 'https://res.cloudinary.com/a.webp');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(prisma.user.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'user-1' }, data: { emailVerified: true } },
      { where: { id: 'user-1' }, data: { passwordHash: 'nouveau-hash' } },
      { where: { id: 'user-1' }, data: { avatarUrl: 'https://res.cloudinary.com/a.webp' } },
    ]);
  });

  it('modifie le profil en fusionnant liens et préférences avec l’existant', async () => {
    prisma.user.findUnique.mockResolvedValue({
      links: { github: 'https://github.com/ada', website: 'https://ada.dev' },
      preferences: { theme: 'dark', language: 'fr' },
    });

    await service.updateProfile('user-1', {
      name: 'Ada L.',
      links: { website: null },
      preferences: { language: 'en' },
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Ada L.',
        bio: undefined,
        links: { github: 'https://github.com/ada', linkedin: null, website: null },
        preferences: { theme: 'dark', language: 'en' },
      },
    });
  });

  it('ne touche ni liens ni préférences quand ils sont absents du corps', async () => {
    prisma.user.findUnique.mockResolvedValue({ links: {}, preferences: {} });

    await service.updateProfile('user-1', { bio: 'Développeuse' });

    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      name: undefined,
      bio: 'Développeuse',
    });
  });

  it('404 pour le profil d’un compte disparu', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.updateProfile('user-9', { name: 'X' })).rejects.toThrow(
      new NotFoundException(ACCOUNT_NOT_FOUND),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('supprime le compte (le reste suit en cascade)', async () => {
    await service.delete('user-1');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });
});

describe('ExportService', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    project: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    goal: { findMany: vi.fn() },
    note: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
  };
  const service = new ExportService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of ['project', 'task', 'goal', 'note', 'tag', 'activity'] as const) {
      prisma[model].findMany.mockResolvedValue([]);
    }
  });

  it('exporte toutes les données de l’utilisateur, sans aucun secret', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'DevMirror',
        description: null,
        status: 'IN_PROGRESS',
        techStack: ['Angular'],
        repoUrl: null,
        demoUrl: null,
        color: '#6366f1',
        tags: [{ name: 'angular' }],
        createdAt,
        updatedAt: createdAt,
        userId: 'user-1',
      },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Tests',
        description: null,
        status: 'DONE',
        priority: 'HIGH',
        dueDate: null,
        completedAt: createdAt,
        projectId: 'p1',
        subtasks: [{ title: 'Unitaires', done: true, position: 0 }],
        createdAt,
        updatedAt: createdAt,
        position: 3,
      },
    ]);
    prisma.goal.findMany.mockResolvedValue([
      {
        id: 'g1',
        title: 'Freelance',
        description: null,
        targetDate: null,
        milestones: [{ title: 'Portfolio', done: false, position: 0 }],
        projects: [{ id: 'p1' }],
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.note.findMany.mockResolvedValue([
      {
        id: 'n1',
        title: 'JWT',
        content: '# Rotation',
        pinned: true,
        projectId: null,
        tags: [{ name: 'nestjs' }],
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.tag.findMany.mockResolvedValue([{ id: 'tag-1', name: 'angular', color: null }]);
    prisma.activity.findMany.mockResolvedValue([
      { id: 'a1', type: 'TASK_COMPLETED', entityType: 'TASK', entityId: 't1', createdAt },
    ]);

    const data = await service.export('user-1');

    expect(data).toMatchObject({
      format: 'devmirror-export',
      version: EXPORT_VERSION,
      profile: {
        id: 'user-1',
        email: 'ada@devmirror.dev',
        links: { github: 'https://github.com/ada' },
      },
      projects: [{ id: 'p1', tags: ['angular'] }],
      tasks: [{ id: 't1', projectId: 'p1', subtasks: [{ title: 'Unitaires', done: true }] }],
      goals: [{ id: 'g1', projectIds: ['p1'], milestones: [{ title: 'Portfolio' }] }],
      notes: [{ id: 'n1', tags: ['nestjs'], pinned: true }],
      tags: [{ name: 'angular', color: null }],
      activity: [{ type: 'TASK_COMPLETED', entityId: 't1' }],
    });
    expect(Date.parse(data.exportedAt)).not.toBeNaN();
    // Ni hash de mot de passe, ni identifiant interne superflu.
    const json = JSON.stringify(data);
    expect(json).not.toContain('argon2');
    expect(json).not.toContain('passwordHash');
    expect(data.tags[0]).not.toHaveProperty('id');
    for (const model of ['project', 'task', 'goal', 'note', 'tag', 'activity'] as const) {
      expect(prisma[model].findMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
    }
  });

  it('404 si le compte n’existe plus', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.export('user-9')).rejects.toThrow(
      new NotFoundException(ACCOUNT_NOT_FOUND),
    );
  });
});

describe('AvatarStorage avec Cloudinary', () => {
  const config = (url?: string) =>
    ({ get: () => url }) as unknown as ConfigService<EnvironmentVariables, true>;
  const storage = () => new AvatarStorage(config('cloudinary://cle%2B1:secr%40t@devmirror'));

  beforeEach(() => vi.clearAllMocks());

  it('lit les identifiants de CLOUDINARY_URL (caractères encodés compris)', () => {
    expect(storage().enabled).toBe(true);
    expect(cloudinaryMock.config).toHaveBeenCalledWith({
      cloud_name: 'devmirror',
      api_key: 'cle+1',
      api_secret: 'secr@t',
      secure: true,
    });
  });

  it('envoie l’image recadrée en WebP sous l’id de l’utilisateur et renvoie son URL', async () => {
    const end = vi.fn();
    cloudinaryMock.uploader.upload_stream.mockImplementation((_options, callback) => {
      queueMicrotask(() =>
        callback(undefined, { secure_url: 'https://res.cloudinary.com/v2/a.webp' }),
      );
      return { end };
    });
    const image = Buffer.from('image');

    await expect(storage().upload('user-1', image)).resolves.toBe(
      'https://res.cloudinary.com/v2/a.webp',
    );
    expect(end).toHaveBeenCalledWith(image);
    expect(cloudinaryMock.uploader.upload_stream.mock.calls[0][0]).toMatchObject({
      folder: 'devmirror/avatars',
      public_id: 'user-1',
      overwrite: true,
      format: 'webp',
      transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
    });
  });

  it('remonte l’erreur de Cloudinary', async () => {
    const failure = new Error('Invalid image file');
    cloudinaryMock.uploader.upload_stream.mockImplementation((_options, callback) => {
      queueMicrotask(() => callback(failure, undefined));
      return { end: vi.fn() };
    });

    await expect(storage().upload('user-1', Buffer.from('x'))).rejects.toBe(failure);
  });

  it('supprime l’avatar et invalide le cache du CDN', async () => {
    cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'ok' });

    await storage().remove('user-1');

    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith('devmirror/avatars/user-1', {
      invalidate: true,
    });
  });
});
