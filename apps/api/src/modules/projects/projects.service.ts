import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Paginated, paginate } from '../../common/dto/paginated-response.dto.js';
import { toSkipTake } from '../../common/dto/pagination-query.dto.js';
import { parseSort } from '../../common/dto/sort.js';
import { Prisma, ProjectStatus, TaskStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import { PROJECT_SORT_FIELDS, type ProjectQueryDto } from './dto/project-query.dto.js';
import type { ProjectProgressDto, ProjectResponseDto } from './dto/project-response.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';
import {
  type AccessRole,
  canEdit,
  editableProjects,
  memberRoleInclude,
  roleOf,
  visibleProjects,
} from './project-access.js';

export const PROJECT_NOT_FOUND = 'Projet introuvable';
export const READ_ONLY_PROJECT = 'Vous avez un accès en lecture seule à ce projet';
export const OWNER_ONLY = 'Seul le propriétaire du projet peut faire cela';

function projectInclude(userId: string) {
  return {
    tags: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
    user: { select: { id: true, name: true, avatarUrl: true } },
    // Le rôle de l'utilisateur connecté, et le nombre de membres pour l'affichage
    members: memberRoleInclude(userId),
    _count: { select: { members: true } },
  } satisfies Prisma.ProjectInclude;
}

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: ReturnType<typeof projectInclude>;
}>;

const NO_TASKS: ProjectProgressDto = { total: 0, done: 0, percent: 0 };

function toResponse(
  userId: string,
  project: ProjectWithRelations,
  progress = NO_TASKS,
): ProjectResponseDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    techStack: project.techStack,
    repoUrl: project.repoUrl,
    demoUrl: project.demoUrl,
    color: project.color,
    tags: project.tags,
    progress,
    // Chargé avec `visibleProjects` : le rôle n'est jamais nul ici
    role: roleOf(userId, project)!,
    owner: project.user,
    memberCount: project._count.members,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** Champs modifiables d'un projet, communs à la création et à la mise à jour. */
function projectFields(dto: CreateProjectDto | UpdateProjectDto) {
  return {
    name: dto.name,
    description: dto.description,
    status: dto.status,
    techStack: dto.techStack,
    repoUrl: dto.repoUrl,
    demoUrl: dto.demoUrl,
    color: dto.color,
  };
}

const toConnect = (ids: readonly string[]) => ids.map((id) => ({ id }));

/**
 * Projets de l'utilisateur connecté et projets partagés avec lui.
 * Les droits (propriétaire, éditeur, lecteur) viennent de `project-access.ts`.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagsService,
  ) {}

  async findAll(userId: string, query: ProjectQueryDto): Promise<Paginated<ProjectResponseDto>> {
    const where = this.buildWhere(userId, query);
    const orderBy = parseSort(query.sort, PROJECT_SORT_FIELDS, { updatedAt: 'desc' });

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        // id en second critère : ordre stable entre deux pages quand le premier est à égalité
        orderBy: [orderBy, { id: 'asc' }],
        include: projectInclude(userId),
        ...toSkipTake(query),
      }),
      this.prisma.project.count({ where }),
    ]);

    const progress = await this.progressByProject(projects.map((project) => project.id));
    return paginate(
      projects.map((project) => toResponse(userId, project, progress.get(project.id))),
      total,
      query,
    );
  }

  async findOne(userId: string, id: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id }, visibleProjects(userId)] },
      include: projectInclude(userId),
    });
    if (!project) throw new NotFoundException(PROJECT_NOT_FOUND);

    const progress = await this.progressByProject([id]);
    return toResponse(userId, project, progress.get(id));
  }

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    await this.tags.assertOwned(userId, dto.tagIds ?? []);

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ...projectFields(dto),
          name: dto.name,
          userId,
          ...(dto.tagIds?.length ? { tags: { connect: toConnect(dto.tagIds) } } : {}),
        },
        include: projectInclude(userId),
      });
      await tx.activity.create({
        data: { userId, type: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: created.id },
      });
      return created;
    });
    return toResponse(userId, project);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    const role = await this.roleFor(userId, id);
    if (!canEdit(role)) throw new ForbiddenException(READ_ONLY_PROJECT);
    if (dto.tagIds) {
      // Les étiquettes sont personnelles : seul le propriétaire étiquette son projet.
      if (role !== 'OWNER') throw new ForbiddenException(OWNER_ONLY);
      await this.tags.assertOwned(userId, dto.tagIds);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...projectFields(dto),
        // `set` remplace la liste entière ; absent du corps, les tags restent inchangés.
        ...(dto.tagIds ? { tags: { set: toConnect(dto.tagIds) } } : {}),
      },
      include: projectInclude(userId),
    });
    const progress = await this.progressByProject([id]);
    return toResponse(userId, project, progress.get(id));
  }

  /** Supprime le projet et ses tâches (cascade) ; ses notes restent, détachées du projet. */
  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.prisma.project.delete({ where: { id } });
  }

  /**
   * Rôle de l'utilisateur sur le projet. Un projet inexistant ou invisible donne 404 :
   * on ne révèle pas l'existence d'un projet à quelqu'un qui n'en fait pas partie.
   */
  async roleFor(userId: string, projectId: string): Promise<AccessRole> {
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, visibleProjects(userId)] },
      select: { userId: true, members: memberRoleInclude(userId) },
    });
    const role = project ? roleOf(userId, project) : null;
    if (!role) throw new NotFoundException(PROJECT_NOT_FOUND);
    return role;
  }

  /** Gestion de l'équipe et suppression : réservées au propriétaire. */
  async assertOwner(userId: string, projectId: string): Promise<void> {
    if ((await this.roleFor(userId, projectId)) !== 'OWNER') {
      throw new ForbiddenException(OWNER_ONLY);
    }
  }

  /** Avant de créer ou déplacer une tâche dans un projet : il faut pouvoir y écrire. */
  async assertCanEdit(userId: string, projectId: string): Promise<void> {
    const count = await this.prisma.project.count({
      where: { AND: [{ id: projectId }, editableProjects(userId)] },
    });
    if (count === 0) throw new BadRequestException(PROJECT_NOT_FOUND);
  }

  /** Avant de rattacher une note personnelle à un projet : il suffit de le voir. */
  async assertVisible(userId: string, projectId: string): Promise<void> {
    const count = await this.prisma.project.count({
      where: { AND: [{ id: projectId }, visibleProjects(userId)] },
    });
    if (count === 0) throw new BadRequestException(PROJECT_NOT_FOUND);
  }

  /** Même contrôle pour une liste (objectifs liés à plusieurs projets) : tout ou rien. */
  async assertAllVisible(userId: string, projectIds: readonly string[]): Promise<void> {
    if (projectIds.length === 0) return;
    const count = await this.prisma.project.count({
      where: { AND: [{ id: { in: [...projectIds] } }, visibleProjects(userId)] },
    });
    if (count !== new Set(projectIds).size) {
      throw new BadRequestException('Un ou plusieurs projets sont introuvables');
    }
  }

  private buildWhere(userId: string, query: ProjectQueryDto): Prisma.ProjectWhereInput {
    const conditions: Prisma.ProjectWhereInput[] = [visibleProjects(userId)];

    if (query.status) {
      conditions.push({ status: query.status });
    } else if (!query.includeArchived) {
      conditions.push({ status: { not: ProjectStatus.ARCHIVED } });
    }
    if (query.q) {
      conditions.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.tag) {
      conditions.push({ tags: { some: { name: { equals: query.tag, mode: 'insensitive' } } } });
    }
    return { AND: conditions };
  }

  /** Progression de plusieurs projets en une seule requête groupée (pas une requête par projet). */
  private async progressByProject(projectIds: string[]): Promise<Map<string, ProjectProgressDto>> {
    const progress = new Map<string, ProjectProgressDto>();
    if (projectIds.length === 0) return progress;

    const counts = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    for (const row of counts) {
      if (!row.projectId) continue;
      const current = progress.get(row.projectId) ?? { total: 0, done: 0, percent: 0 };
      current.total += row._count._all;
      if (row.status === TaskStatus.DONE) current.done += row._count._all;
      progress.set(row.projectId, current);
    }
    for (const value of progress.values()) {
      value.percent = value.total === 0 ? 0 : Math.round((value.done / value.total) * 100);
    }
    return progress;
  }
}
