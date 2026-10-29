import { Module } from '@nestjs/common';
import { AvatarStorage } from './avatar-storage.js';
import { ExportService } from './export.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AvatarStorage, ExportService],
  // AvatarStorage : la suppression de compte (module auth) retire aussi l'avatar.
  exports: [UsersService, AvatarStorage],
})
export class UsersModule {}
