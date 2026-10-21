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
import { ReorderTasksDto } from './dto/reorder-tasks.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TaskResponseDto } from './dto/task-response.dto.js';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Lister ses tâches (projet, statut, priorité, échéance, recherche)' })
  @ApiPaginatedResponse(TaskResponseDto)
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Paramètres invalides' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: TaskQueryDto,
  ): Promise<Paginated<TaskResponseDto>> {
    return this.tasks.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une tâche' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou projet introuvable',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.tasks.create(user.id, dto);
  }

  // Déclarée avant PATCH :id, sinon « reorder » serait pris pour un identifiant.
  @Patch('reorder')
  @ApiOperation({
    summary: 'Enregistrer une colonne du Kanban après un glisser-déposer',
    description:
      'Statut et positions de toutes les tâches de la colonne, dans l’ordre reçu, en une transaction.',
  })
  @ApiOkResponse({
    type: [TaskResponseDto],
    description: 'Tâches de la colonne, dans le nouvel ordre',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou tâche introuvable (rien n’est modifié)',
  })
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderTasksDto): Promise<TaskResponseDto[]> {
    return this.tasks.reorder(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une tâche' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tâche introuvable' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TaskResponseDto> {
    return this.tasks.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une tâche',
    description:
      'Passer à DONE renseigne completedAt ; changer de statut sans position place la tâche en bas de la colonne.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou projet introuvable',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tâche introuvable' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une tâche et ses sous-tâches' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tâche introuvable' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.tasks.remove(user.id, id);
  }
}
