import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [NotesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
