import { ApiProperty } from '@nestjs/swagger';

export class NoteProjectDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'DevMirror' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#6366f1' })
  color: string | null;
}

export class NoteTagDto {
  @ApiProperty({ example: 'clx0tag000001' })
  id: string;

  @ApiProperty({ example: 'nestjs' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '#e0234e' })
  color: string | null;
}

/** Élément de liste : un extrait en texte brut à la place du contenu complet. */
export class NoteSummaryDto {
  @ApiProperty({ example: 'clx0note00001' })
  id: string;

  @ApiProperty({ example: 'Pièges du rafraîchissement JWT' })
  title: string;

  @ApiProperty({
    description: 'Début du contenu sans la syntaxe Markdown (200 caractères au plus)',
    example: 'Rotation Un refresh token ne sert qu’une fois.',
  })
  excerpt: string;

  @ApiProperty({ example: false })
  pinned: boolean;

  @ApiProperty({ type: NoteProjectDto, nullable: true })
  project: NoteProjectDto | null;

  @ApiProperty({ type: [NoteTagDto] })
  tags: NoteTagDto[];

  @ApiProperty({ example: '2026-10-24T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-24T09:00:00.000Z' })
  updatedAt: Date;
}

export class NoteResponseDto extends NoteSummaryDto {
  @ApiProperty({ example: '## Rotation\n\nUn refresh token ne sert **qu’une fois**.' })
  content: string;
}
