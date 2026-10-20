import { ApiProperty } from '@nestjs/swagger';

/** Format unique des erreurs de l'API (cahier des charges, section 6.1). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Ressource introuvable',
    description: 'Message affichable ; liste de messages pour les erreurs de validation',
  })
  message: string | string[];

  @ApiProperty({ example: 'Not Found' })
  error: string;

  @ApiProperty({ example: '/api/v1/projects/clx1a2b3c' })
  path: string;

  @ApiProperty({ example: '2026-10-20T09:00:00.000Z' })
  timestamp: string;
}
