import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ActivityCalendarDto, StatsOverviewDto, StatsQueryDto } from './dto/stats.dto.js';
import { StatsService } from './stats.service.js';

@ApiTags('stats')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Fuseau horaire inconnu' })
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Tableau de bord en une requête : indicateurs, tâches par semaine, projets par statut, échéances, notes récentes, activité',
  })
  @ApiOkResponse({ type: StatsOverviewDto })
  overview(
    @CurrentUser() user: AuthUser,
    @Query() query: StatsQueryDto,
  ): Promise<StatsOverviewDto> {
    return this.stats.overview(user.id, query.tz);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Actions par jour sur 53 semaines (heatmap)' })
  @ApiOkResponse({ type: ActivityCalendarDto })
  activity(
    @CurrentUser() user: AuthUser,
    @Query() query: StatsQueryDto,
  ): Promise<ActivityCalendarDto> {
    return this.stats.activity(user.id, query.tz);
  }
}
