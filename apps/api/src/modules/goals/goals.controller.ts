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
import { GoalQueryDto } from './dto/goal-query.dto.js';
import { GoalResponseDto, MilestoneDto } from './dto/goal-response.dto.js';
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto.js';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto.js';
import { GoalsService } from './goals.service.js';
import { MilestonesService } from './milestones.service.js';

@ApiTags('goals')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly milestones: MilestonesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister ses objectifs (en cours / atteints, projet, recherche)' })
  @ApiPaginatedResponse(GoalResponseDto)
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Paramètres invalides' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: GoalQueryDto,
  ): Promise<Paginated<GoalResponseDto>> {
    return this.goals.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un objectif, avec ses jalons de départ' })
  @ApiCreatedResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou projet introuvable',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto): Promise<GoalResponseDto> {
    return this.goals.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un objectif' })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Objectif introuvable' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GoalResponseDto> {
    return this.goals.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un objectif (projectIds remplace la liste)' })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou projet introuvable',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Objectif introuvable' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goals.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un objectif et ses jalons' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Objectif introuvable' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.goals.remove(user.id, id);
  }

  @Post(':goalId/milestones')
  @ApiOperation({ summary: 'Ajouter un jalon (en dernier)' })
  @ApiCreatedResponse({ type: MilestoneDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou limite atteinte',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Objectif introuvable' })
  addMilestone(
    @CurrentUser() user: AuthUser,
    @Param('goalId') goalId: string,
    @Body() dto: CreateMilestoneDto,
  ): Promise<MilestoneDto> {
    return this.milestones.create(user.id, goalId, dto);
  }

  @Patch(':goalId/milestones/:id')
  @ApiOperation({ summary: 'Cocher, renommer ou déplacer un jalon' })
  @ApiOkResponse({ type: MilestoneDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Jalon introuvable' })
  updateMilestone(
    @CurrentUser() user: AuthUser,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ): Promise<MilestoneDto> {
    return this.milestones.update(user.id, goalId, id, dto);
  }

  @Delete(':goalId/milestones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un jalon' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Jalon introuvable' })
  removeMilestone(
    @CurrentUser() user: AuthUser,
    @Param('goalId') goalId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.milestones.remove(user.id, goalId, id);
  }
}
