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
import { SearchQueryDto, SearchResultsDto } from './dto/search.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('search')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Recherche globale dans ses projets, tâches et notes (palette Ctrl+K)',
  })
  @ApiOkResponse({ type: SearchResultsDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Recherche trop courte ou trop longue',
  })
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto): Promise<SearchResultsDto> {
    return this.searchService.search(user.id, query);
  }
}
