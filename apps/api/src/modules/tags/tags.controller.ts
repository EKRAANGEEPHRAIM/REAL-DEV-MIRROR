import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { CreateTagDto, TagResponseDto, UpdateTagDto } from './dto/tag.dto.js';
import { TagsService } from './tags.service.js';

@ApiTags('tags')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister ses tags (ordre alphabétique) avec leur utilisation' })
  @ApiOkResponse({ type: [TagResponseDto] })
  findAll(@CurrentUser() user: AuthUser): Promise<TagResponseDto[]> {
    return this.tags.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un tag (nom enregistré en minuscules)' })
  @ApiCreatedResponse({ type: TagResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou limite atteinte',
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Un tag porte déjà ce nom' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTagDto): Promise<TagResponseDto> {
    return this.tags.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renommer un tag ou changer sa couleur' })
  @ApiOkResponse({ type: TagResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tag introuvable' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Un tag porte déjà ce nom' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    return this.tags.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un tag (retiré des projets et notes)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tag introuvable' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.tags.remove(user.id, id);
  }
}
