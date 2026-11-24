import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Paginated, paginate } from '../../common/dto/paginated-response.dto.js';
import { toSkipTake } from '../../common/dto/pagination-query.dto.js';
import { parseSort } from '../../common/dto/sort.js';
import { Prisma, TaskStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { editableTasks, visibleTasks } from '../projects/project-access.js';
import { ProjectsService, READ_ONLY_PROJECT } from '../projects/projects.service.js';
import type { ReorderTasksDto } from './dto/reorder-tasks.dto.js';
import { TASK_SORT_FIELDS, type TaskQueryDto } from './dto/task-query.dto.js';
import type { TaskResponseDto } from './dto/task-response.dto.js';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';

export const TASK_NOT_FOUND = 'Tâche introuvable';
export const UNKNOWN_TASKS = 'Une ou plusieurs tâches sont introuvables';
export const TASK_LEAVE_PROJECT =
  'Seul l’auteur d’une tâche peut la retirer du projet pour en faire une tâche personnelle';

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  subtasks: {
    select: { id: true, title: true, done: true, position: true },
    // id en second critère : ordre stable même si deux sous-tâches ont la même position
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type Tx = Prisma.TransactionClient;

function toResponse(task: TaskWithRelations): TaskResponseDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    position: task.position,
    completedAt: task.completedAt,
    project: task.project,
    subtasks: task.subtasks,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/**
 * Tâches personnelles de l'utilisateur et tâches des projets partagés avec lui.
 * Les droits (lecture, écriture) viennent de `project-access.ts`.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAll(userId: string, query: TaskQueryDto): Promise<Paginated<TaskResponseDto>> {
    const where = this.buildWhere(userId, query);
    const sort = parseSort(query.sort, TASK_SORT_FIELDS, { createdAt: 'desc' });
    // Les tâches sans échéance passent après les autres, quel que soit le sens du tri.
    const orderBy: Prisma.TaskOrderByWithRelationInput = sort.dueDate
      ? { dueDate: { sort: sort.dueDate, nulls: 'last' } }
      : sort;

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        include: taskInclude,
        ...toSkipTake(query),
      }),
      this.prisma.task.count({ where }),
    ]);
    return paginate(tasks.map(toResponse), total, query);
  }

  async findOne(userId: string, id: string): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: { AND: [{ id }, visibleTasks(userId)] },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException(TASK_NOT_FOUND);
    return toResponse(task);
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    if (dto.projectId) await this.projects.assertCanEdit(userId, dto.projectId);
    const status = dto.status ?? TaskStatus.TODO;
    const projectId = dto.projectId ?? null;

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          userId,
          projectId,
          title: dto.title,
          description: dto.description,
          status,
          priority: dto.priority,
          dueDate: dto.dueDate,
          position: dto.position ?? (await this.nextPosition(tx, userId, projectId, status)),
          completedAt: status === TaskStatus.DONE ? new Date() : null,
        },
        include: taskInclude,
      });
      if (status === TaskStatus.DONE) await this.recordCompletion(tx, userId, created.id);
      return created;
    });
    return toResponse(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const existing = await this.findEditable(userId, id);
    if (dto.projectId) await this.projects.assertCanEdit(userId, dto.projectId);
    // Sortie du projet : la tâche redeviendrait personnelle à son auteur, invisible pour l'équipe.
    if (dto.projectId === null && existing.projectId && existing.userId !== userId) {
      throw new ForbiddenException(TASK_LEAVE_PROJECT);
    }

    const status = dto.status ?? existing.status;
    const projectId = dto.projectId === undefined ? existing.projectId : dto.projectId;
    const statusChanged = status !== existing.status;
    const becameDone = statusChanged && status === TaskStatus.DONE;

    const task = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TaskUncheckedUpdateInput = {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        projectId: dto.projectId,
      };
      if (statusChanged) data.completedAt = becameDone ? new Date() : null;
      if (dto.position !== undefined) {
        data.position = dto.position;
      } else if (statusChanged || projectId !== existing.projectId) {
        // Nouvelle colonne (ou nouveau projet) : la tâche arrive en bas.
        data.position = await this.nextPosition(tx, userId, projectId, status);
      }

      const updated = await tx.task.update({ where: { id }, data, include: taskInclude });
      if (becameDone) await this.recordCompletion(tx, userId, id);
      return updated;
    });
    return toResponse(task);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findEditable(userId, id);
    await this.prisma.task.delete({ where: { id } });
  }

  /**
   * Tâche que l'utilisateur peut modifier. Invisible : 404 (on ne révèle pas qu'elle existe) ;
   * visible en lecture seule : 403.
   */
  async findEditable(
    userId: string,
    id: string,
  ): Promise<{ status: TaskStatus; projectId: string | null; userId: string }> {
    const [editable, visible] = await this.prisma.$transaction([
      this.prisma.task.findFirst({
        where: { AND: [{ id }, editableTasks(userId)] },
        select: { status: true, projectId: true, userId: true },
      }),
      this.prisma.task.count({ where: { AND: [{ id }, visibleTasks(userId)] } }),
    ]);
    if (editable) return editable;
    if (visible > 0) throw new ForbiddenException(READ_ONLY_PROJECT);
    throw new NotFoundException(TASK_NOT_FOUND);
  }

  /**
   * Enregistre une colonne du Kanban après un glisser-déposer : statut et positions 0, 1, 2…
   * dans l'ordre reçu, en une transaction. Tout ou rien : un seul id inconnu (ou d'une tâche
   * qu'il ne peut pas modifier) refuse l'ensemble. Seules les tâches qui changent sont mises à jour.
   */
  async reorder(userId: string, dto: ReorderTasksDto): Promise<TaskResponseDto[]> {
    const current = await this.prisma.task.findMany({
      where: { AND: [{ id: { in: dto.taskIds } }, editableTasks(userId)] },
      select: { id: true, status: true, position: true },
    });
    if (current.length !== dto.taskIds.length) throw new BadRequestException(UNKNOWN_TASKS);
    const before = new Map(current.map((task) => [task.id, task]));

    await this.prisma.$transaction(async (tx) => {
      for (const [position, id] of dto.taskIds.entries()) {
        const previous = before.get(id)!;
        const statusChanged = previous.status !== dto.status;
        if (!statusChanged && previous.position === position) continue;

        await tx.task.update({
          where: { id },
          data: {
            position,
            status: dto.status,
            ...(statusChanged && {
              completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
            }),
          },
        });
        if (statusChanged && dto.status === TaskStatus.DONE) {
          await this.recordCompletion(tx, userId, id);
        }
      }
    });

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: dto.taskIds } },
      orderBy: { position: 'asc' },
      include: taskInclude,
    });
    return tasks.map(toResponse);
  }

  private buildWhere(userId: string, query: TaskQueryDto): Prisma.TaskWhereInput {
    const conditions: Prisma.TaskWhereInput[] = [visibleTasks(userId)];

    if (query.projectId) conditions.push({ projectId: query.projectId });
    else if (query.withoutProject) conditions.push({ projectId: null });
    if (query.status) conditions.push({ status: query.status });
    if (query.priority) conditions.push({ priority: query.priority });
    if (query.q) conditions.push({ title: { contains: query.q, mode: 'insensitive' } });

    if (query.noDueDate) {
      conditions.push({ dueDate: null });
    } else {
      if (query.dueFrom) conditions.push({ dueDate: { gte: query.dueFrom } });
      if (query.dueTo) conditions.push({ dueDate: { lt: query.dueTo } });
    }
    if (query.overdue) {
      conditions.push({ dueDate: { lt: new Date() } }, { status: { not: TaskStatus.DONE } });
    }
    return { AND: conditions };
  }

  /**
   * Position en bas d'une colonne. Dans un projet, la colonne est commune à toute l'équipe ;
   * sans projet, elle est propre à l'utilisateur.
   */
  private async nextPosition(
    tx: Tx,
    userId: string,
    projectId: string | null,
    status: TaskStatus,
  ): Promise<number> {
    const { _max } = await tx.task.aggregate({
      where: projectId ? { projectId, status } : { userId, projectId: null, status },
      _max: { position: true },
    });
    return _max.position === null ? 0 : _max.position + 1;
  }

  /** Alimente les statistiques et la heatmap d'activité (cahier des charges, section 4.4). */
  private async recordCompletion(tx: Tx, userId: string, taskId: string): Promise<void> {
    await tx.activity.create({
      data: { userId, type: 'TASK_COMPLETED', entityType: 'TASK', entityId: taskId },
    });
  }
}
