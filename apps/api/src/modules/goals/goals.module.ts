import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';
import { MilestonesService } from './milestones.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [GoalsController],
  providers: [GoalsService, MilestonesService],
})
export class GoalsModule {}
