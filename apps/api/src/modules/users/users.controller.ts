import {
  BadRequestException,
  Body,
  type CallHandler,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  NotFoundException,
  Patch,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import {
  AVATAR_INVALID_TYPE,
  AVATAR_MISSING,
  AVATAR_TOO_LARGE,
  detectImageType,
  MAX_AVATAR_BYTES,
  type UploadedImage,
} from './avatar-file.js';
import { AvatarStorage } from './avatar-storage.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { ACCOUNT_NOT_FOUND, UsersService } from './users.service.js';

/** Multer en mémoire, limité à 2 Mo ; son message anglais de dépassement est traduit. */
@Injectable()
class AvatarUploadInterceptor extends FileInterceptor('avatar', {
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
}) {
  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException(AVATAR_TOO_LARGE);
      }
      throw error;
    }
  }
}

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly avatars: AvatarStorage,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Profil de l’utilisateur connecté' })
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() current: AuthUser): Promise<UserResponseDto> {
    const user = await this.users.findById(current.id);
    // Compte supprimé alors que son jeton d'accès est encore valide.
    if (!user) throw new NotFoundException(ACCOUNT_NOT_FOUND);
    return UserResponseDto.fromUser(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Modifier son profil (nom, bio, liens, préférences)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Données invalides' })
  async update(
    @CurrentUser() current: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromUser(await this.users.updateProfile(current.id, dto));
  }

  @Post('me/avatar')
  @UseInterceptors(AvatarUploadInterceptor)
  @ApiOperation({
    summary: 'Envoyer un avatar (JPEG, PNG, WebP ou GIF, 2 Mo au plus) ; recadré en 256 × 256',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Fichier absent ou non image' })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto, description: 'Image de plus de 2 Mo' })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'Stockage des avatars non configuré',
  })
  async uploadAvatar(
    @CurrentUser() current: AuthUser,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<UserResponseDto> {
    if (!file) throw new BadRequestException(AVATAR_MISSING);
    if (!detectImageType(file.buffer)) throw new BadRequestException(AVATAR_INVALID_TYPE);

    const url = await this.avatars.upload(current.id, file.buffer);
    return UserResponseDto.fromUser(await this.users.setAvatar(current.id, url));
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer son avatar' })
  @ApiNoContentResponse()
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'Stockage des avatars non configuré',
  })
  async removeAvatar(@CurrentUser() current: AuthUser): Promise<void> {
    await this.avatars.remove(current.id);
    await this.users.setAvatar(current.id, null);
  }
}
