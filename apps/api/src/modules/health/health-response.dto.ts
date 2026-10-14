import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 42, description: "Durée de fonctionnement de l'API, en secondes" })
  uptime: number;

  @ApiProperty({ example: '2026-10-14T12:00:00.000Z' })
  timestamp: string;
}
