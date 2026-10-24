import { Injectable, NotFoundException } from '@nestjs/common';
import { type Paginated, paginate } from '../../common/dto/paginated-response.dto.js';
import { toSkipTake } from '../../common/dto/pagination-query.dto.js';
import { parseSort } from '../../common/dto/sort.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { GOAL_SORT_FIELDS, type GoalQueryDto } from './dto/goal-query.dto.js';
import type { GoalResponseDto } from './dto/goal-response.dto.js';
import type { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto.js';

export const GOAL_NOT_FOUND = 'Objectif introuvable';

const goalInclude = {
  milestones: {
    select: { id: true, title: true, done: true, position: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
  projects: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.GoalInclude;

type GoalWithRelations = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

/** « Atteint » : au moins un jalon, et tous faits. Traduit en filtre Prisma pour paginer juste. */
const COMPLETED: Prisma.GoalWhereInput = {
  milestones: { some: {}, every: { done: true } },
};
const ACTIVE: Prisma.GoalWhereInput = {
  OR: [{ milestones: { none: {} } }, { milestones: { some: { done: false } } }],
};

export function toGoalResponse(goal: GoalWithRelations): GoalResponseDto {
  const total = goal.milestones.length;
  const done = goal.milestones.filter((milestone) => milestone.done).length;
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    targetDate: goal.targetDate,
    milestones: goal.milestones,
    projects: goal.projects,
    progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
    completed: total > 0 && done === total,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

const toConnect = (ids: readonly string[]) => ids.map((id) => ({ id }));

/** Objectifs de l'utilisateur connecté : toute requête est filtrée par `userId`. */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAll(userId: string, query: GoalQueryDto): Promise<Paginated<GoalResponseDto>> {
    const conditions: Prisma.GoalWhereInput[] = [{ userId }];
    if (query.state === 'completed') conditions.push(COMPLETED);
    if (query.state === 'active') conditions.push(ACTIVE);
    if (query.projectId) conditions.push({ projects: { some: { id: query.projectId } } });
    if (query.q) {
      conditions.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.GoalWhereInput = { AND: conditions };

    const sort = parseSort(query.sort, GOAL_SORT_FIELDS, { targetDate: 'asc' });
    // Les objectifs sans date cible passent après les autres.
    const orderBy: Prisma.GoalOrderByWithRelationInput = sort.targetDate
      ? { targetDate: { sort: sort.targetDate, nulls: 'last' } }
      : sort;

    const [goals, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        include: goalInclude,
        ...toSkipTake(query),
      }),
      this.prisma.goal.count({ where }),
    ]);
    return paginate(goals.map(toGoalResponse), total, query);
  }

  async findOne(userId: string, id: string): Promise<GoalResponseDto> {
    const goal = await this.prisma.goal.findFirst({ where: { id, userId }, include: goalInclude });
    if (!goal) throw new NotFoundException(GOAL_NOT_FOUND);
    return toGoalResponse(goal);
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponseDto> {
    await this.projects.assertAllOwned(userId, dto.projectIds ?? []);

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        targetDate: dto.targetDate,
        ...(dto.projectIds?.length ? { projects: { connect: toConnect(dto.projectIds) } } : {}),
        ...(dto.milestones?.length
          ? {
              milestones: {
                create: dto.milestones.map((title, position) => ({ title, position })),
              },
            }
          : {}),
      },
      include: goalInclude,
    });
    return toGoalResponse(goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalResponseDto> {
    if (dto.projectIds) await this.projects.assertAllOwned(userId, dto.projectIds);
    try {
      const goal = await this.prisma.goal.update({
        where: { id, userId },
        data: {
          title: dto.title,
          description: dto.description,
          targetDate: dto.targetDate,
          // `set` remplace la liste ; absente du corps, elle reste inchangée.
          ...(dto.projectIds ? { projects: { set: toConnect(dto.projectIds) } } : {}),
        },
        include: goalInclude,
      });
      return toGoalResponse(goal);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(GOAL_NOT_FOUND);
      }
      throw error;
    }
  }

  /** Supprime l'objectif et ses jalons ; les projets liés ne sont pas touchés. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.goal.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException(GOAL_NOT_FOUND);
  }
}
