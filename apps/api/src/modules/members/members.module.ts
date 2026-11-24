import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { InvitationsController } from './invitations.controller.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

/** Équipes : membres d'un projet, rôles et invitations par email. */
@Module({
  imports: [ProjectsModule],
  controllers: [MembersController, InvitationsController],
  providers: [MembersService],
})
export class MembersModule {}
