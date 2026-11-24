import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { editableTasks, visibleTasks } from '../projects/project-access.js';
import { READ_ONLY_PROJECT } from '../projects/projects.service.js';
import type { CreateSubtaskDto, UpdateSubtaskDto } from './dto/subtask.dto.js';
import type { SubtaskDto } from './dto/task-response.dto.js';
import { TASK_NOT_FOUND } from './tasks.service.js';

export const SUBTASK_NOT_FOUND = 'Sous-tâche introuvable';
export const MAX_SUBTASKS_PER_TASK = 50;

const subtaskSelect = { id: true, title: true, done: true, position: true } as const;

/** Checklist d'une tâche ; les droits sont ceux de la tâche parente (et donc de son projet). */
@Injectable()
export class SubtasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, taskId: string, dto: CreateSubtaskDto): Promise<SubtaskDto> {
    await this.assertTaskEditable(userId, taskId);

    const [count, last] = await Promise.all([
      this.prisma.subtask.count({ where: { taskId } }),
      this.prisma.subtask.aggregate({ where: { taskId }, _max: { position: true } }),
    ]);
    if (count >= MAX_SUBTASKS_PER_TASK) {
      throw new BadRequestException(`${MAX_SUBTASKS_PER_TASK} sous-tâches au maximum par tâche`);
    }

    return this.prisma.subtask.create({
      data: {
        taskId,
        title: dto.title,
        position: last._max.position === null ? 0 : last._max.position + 1,
      },
      select: subtaskSelect,
    });
  }

  async update(
    userId: string,
    taskId: string,
    id: string,
    dto: UpdateSubtaskDto,
  ): Promise<SubtaskDto> {
    await this.assertSubtaskOwned(userId, taskId, id);
    return this.prisma.subtask.update({
      where: { id },
      data: { title: dto.title, done: dto.done, position: dto.position },
      select: subtaskSelect,
    });
  }

  async remove(userId: string, taskId: string, id: string): Promise<void> {
    await this.assertSubtaskOwned(userId, taskId, id);
    await this.prisma.subtask.delete({ where: { id } });
  }

  /** Invisible : 404 ; visible en lecture seule : 403. */
  private async assertTaskEditable(userId: string, taskId: string): Promise<void> {
    const [editable, visible] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { AND: [{ id: taskId }, editableTasks(userId)] } }),
      this.prisma.task.count({ where: { AND: [{ id: taskId }, visibleTasks(userId)] } }),
    ]);
    if (editable > 0) return;
    if (visible > 0) throw new ForbiddenException(READ_ONLY_PROJECT);
    throw new NotFoundException(TASK_NOT_FOUND);
  }

  /** La sous-tâche doit appartenir à cette tâche, que l'utilisateur peut modifier. */
  private async assertSubtaskOwned(userId: string, taskId: string, id: string): Promise<void> {
    await this.assertTaskEditable(userId, taskId);
    const count = await this.prisma.subtask.count({ where: { id, taskId } });
    if (count === 0) throw new NotFoundException(SUBTASK_NOT_FOUND);
  }
}
