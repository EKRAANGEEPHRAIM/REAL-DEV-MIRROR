import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Envoyer 10 candidatures', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200, { message: 'Le titre doit contenir entre 1 et 200 caractères' })
  title: string;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 200, { message: 'Le titre doit contenir entre 1 et 200 caractères' })
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'done doit être un booléen' })
  done?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
