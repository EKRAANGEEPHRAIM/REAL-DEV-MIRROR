import { Controller, Get, NotFoundException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Profil de l’utilisateur connecté' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Jeton d’accès manquant ou invalide' })
  async me(@CurrentUser() current: AuthUser): Promise<UserResponseDto> {
    const user = await this.users.findById(current.id);
    // Compte supprimé alors que son jeton d'accès est encore valide.
    if (!user) throw new NotFoundException('Compte introuvable');
    return UserResponseDto.fromUser(user);
  }
}
