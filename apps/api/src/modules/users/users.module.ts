import { Module } from '@nestjs/common';
import { AvatarStorage } from './avatar-storage.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AvatarStorage],
  exports: [UsersService],
})
export class UsersModule {}
