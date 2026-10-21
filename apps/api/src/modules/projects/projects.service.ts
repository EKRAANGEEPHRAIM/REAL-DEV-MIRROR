import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

export const PROJECT_NOT_FOUND = 'Projet introuvable';

const projectInclude = {
  tags: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.ProjectInclude;

type ProjectWithTags = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

const NO_TASKS: ProjectProgressDto = { total: 0, done: 0, percent: 0 };

function toResponse(project: ProjectWithTags, progress = NO_TASKS): ProjectResponseDto {
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
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
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

/** Projets de l'utilisateur connecté : toute requête est filtrée par `userId`. */
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
        include: projectInclude,
        ...toSkipTake(query),
      }),
      this.prisma.project.count({ where }),
    ]);

    const progress = await this.progressByProject(projects.map((project) => project.id));
    return paginate(
      projects.map((project) => toResponse(project, progress.get(project.id))),
      total,
      query,
    );
  }

  async findOne(userId: string, id: string): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException(PROJECT_NOT_FOUND);

    const progress = await this.progressByProject([id]);
    return toResponse(project, progress.get(id));
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
        include: projectInclude,
      });
      await tx.activity.create({
        data: { userId, type: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: created.id },
      });
      return created;
    });
    return toResponse(project);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    if (dto.tagIds) await this.tags.assertOwned(userId, dto.tagIds);

    try {
      // `userId` dans le where : modifier le projet d'un autre utilisateur donne P2025 -> 404.
      const project = await this.prisma.project.update({
        where: { id, userId },
        data: {
          ...projectFields(dto),
          // `set` remplace la liste entière ; absent du corps, les tags restent inchangés.
          ...(dto.tagIds ? { tags: { set: toConnect(dto.tagIds) } } : {}),
        },
        include: projectInclude,
      });
      const progress = await this.progressByProject([id]);
      return toResponse(project, progress.get(id));
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException(PROJECT_NOT_FOUND);
      throw error;
    }
  }

  /** Supprime le projet et ses tâches (cascade) ; ses notes restent, détachées du projet. */
  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.prisma.project.delete({ where: { id, userId } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException(PROJECT_NOT_FOUND);
      throw error;
    }
  }

  /** Vérifie qu'un projet appartient à l'utilisateur avant d'y rattacher une tâche ou une note. */
  async assertOwned(userId: string, projectId: string): Promise<void> {
    const owned = await this.prisma.project.count({ where: { id: projectId, userId } });
    if (owned === 0) throw new BadRequestException(PROJECT_NOT_FOUND);
  }

  private buildWhere(userId: string, query: ProjectQueryDto): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: ProjectStatus.ARCHIVED };
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.tag) {
      where.tags = { some: { name: { equals: query.tag, mode: 'insensitive' } } };
    }
    return where;
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
