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
import { NoteQueryDto } from './dto/note-query.dto.js';
import { NoteResponseDto, NoteSummaryDto } from './dto/note-response.dto.js';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';
import { NotesService } from './notes.service.js';

@ApiTags('notes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Jeton d’accès manquant ou invalide',
})
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister ses notes (épinglées en tête) : recherche plein texte, projet, tag',
  })
  @ApiPaginatedResponse(NoteSummaryDto)
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Paramètres invalides' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: NoteQueryDto,
  ): Promise<Paginated<NoteSummaryDto>> {
    return this.notes.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une note' })
  @ApiCreatedResponse({ type: NoteResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides, projet ou tag introuvable',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto): Promise<NoteResponseDto> {
    return this.notes.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une note, avec son contenu Markdown' })
  @ApiOkResponse({ type: NoteResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Note introuvable' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<NoteResponseDto> {
    return this.notes.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier, épingler ou rattacher une note (tagIds remplace la liste)' })
  @ApiOkResponse({ type: NoteResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides, projet ou tag introuvable',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Note introuvable' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notes.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une note' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Note introuvable' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.notes.remove(user.id, id);
  }
}
