import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../../generated/prisma/client.js';

/** Représentation publique d'un compte : jamais de hash de mot de passe. */
export class UserResponseDto {
  @ApiProperty({ example: 'clx1a2b3c0000qz8h4k9d7f2e' })
  id: string;

  @ApiProperty({ example: 'ada@devmirror.dev' })
  email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl: string | null;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: '2026-10-17T09:00:00.000Z' })
  createdAt: Date;

  static fromUser(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
