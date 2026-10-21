import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
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
import { CreateSubtaskDto, UpdateSubtaskDto } from './dto/subtask.dto.js';
import { SubtaskDto } from './dto/task-response.dto.js';
import { SubtasksService } from './subtasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('tasks/:taskId/subtasks')
export class SubtasksController {
  constructor(private readonly subtasks: SubtasksService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter une sous-tâche (en bas de la checklist)' })
  @ApiCreatedResponse({ type: SubtaskDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou limite atteinte',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Tâche introuvable' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ): Promise<SubtaskDto> {
    return this.subtasks.create(user.id, taskId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cocher, renommer ou déplacer une sous-tâche' })
  @ApiOkResponse({ type: SubtaskDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Sous-tâche introuvable' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubtaskDto,
  ): Promise<SubtaskDto> {
    return this.subtasks.update(user.id, taskId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une sous-tâche' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Sous-tâche introuvable' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.subtasks.remove(user.id, taskId, id);
  }
}
