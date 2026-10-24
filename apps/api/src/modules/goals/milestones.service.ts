import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MilestoneDto } from './dto/goal-response.dto.js';
import { MAX_MILESTONES_PER_GOAL } from './dto/goal.dto.js';
import type { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto.js';
import { GOAL_NOT_FOUND } from './goals.service.js';

export const MILESTONE_NOT_FOUND = 'Jalon introuvable';

const milestoneSelect = { id: true, title: true, done: true, position: true } as const;

/** Jalons d'un objectif ; l'appartenance est vérifiée à travers l'objectif parent. */
@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, goalId: string, dto: CreateMilestoneDto): Promise<MilestoneDto> {
    const owned = await this.prisma.goal.count({ where: { id: goalId, userId } });
    if (owned === 0) throw new NotFoundException(GOAL_NOT_FOUND);

    const [count, last] = await Promise.all([
      this.prisma.milestone.count({ where: { goalId } }),
      this.prisma.milestone.aggregate({ where: { goalId }, _max: { position: true } }),
    ]);
    if (count >= MAX_MILESTONES_PER_GOAL) {
      throw new BadRequestException(`${MAX_MILESTONES_PER_GOAL} jalons au maximum par objectif`);
    }

    return this.prisma.milestone.create({
      data: {
        goalId,
        title: dto.title,
        position: last._max.position === null ? 0 : last._max.position + 1,
      },
      select: milestoneSelect,
    });
  }

  /** Cocher un jalon enregistre une activité (heatmap du tableau de bord). */
  async update(
    userId: string,
    goalId: string,
    id: string,
    dto: UpdateMilestoneDto,
  ): Promise<MilestoneDto> {
    const existing = await this.prisma.milestone.findFirst({
      where: { id, goalId, goal: { userId } },
      select: { done: true },
    });
    if (!existing) throw new NotFoundException(MILESTONE_NOT_FOUND);

    const becameDone = dto.done === true && !existing.done;
    return this.prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.update({
        where: { id },
        data: { title: dto.title, done: dto.done, position: dto.position },
        select: milestoneSelect,
      });
      if (becameDone) {
        await tx.activity.create({
          data: { userId, type: 'MILESTONE_COMPLETED', entityType: 'MILESTONE', entityId: id },
        });
      }
      return milestone;
    });
  }

  async remove(userId: string, goalId: string, id: string): Promise<void> {
    const { count } = await this.prisma.milestone.deleteMany({
      where: { id, goalId, goal: { userId } },
    });
    if (count === 0) throw new NotFoundException(MILESTONE_NOT_FOUND);
  }
}
