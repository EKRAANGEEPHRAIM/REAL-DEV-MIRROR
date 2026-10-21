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
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { ApiPaginatedResponse, type Paginated } from '../../common/dto/paginated-response.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectQueryDto } from './dto/project-query.dto.js';
import { ProjectResponseDto } from './dto/project-response.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister ses projets (filtres, recherche, tri, pagination)' })
  @ApiPaginatedResponse(ProjectResponseDto)
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Paramètres invalides' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ProjectQueryDto,
  ): Promise<Paginated<ProjectResponseDto>> {
    return this.projects.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un projet' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Données invalides' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projects.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un projet' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Projet introuvable' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProjectResponseDto> {
    return this.projects.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un projet (champs envoyés uniquement)' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Données invalides' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Projet introuvable' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projects.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un projet et ses tâches' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Projet introuvable' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.projects.remove(user.id, id);
  }
}
