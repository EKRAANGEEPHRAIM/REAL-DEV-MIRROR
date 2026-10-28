import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [ProjectsModule, TagsModule],
  controllers: [NotesController],
  providers: [NotesService],
  // La recherche globale réutilise la recherche plein texte des notes.
  exports: [NotesService],
})
export class NotesModule {}
