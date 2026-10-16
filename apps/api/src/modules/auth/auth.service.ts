import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';

export const EMAIL_TAKEN_MESSAGE = 'Un compte existe déjà avec cet email';
export const INVALID_CREDENTIALS_MESSAGE = 'Email ou mot de passe incorrect';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException(EMAIL_TAKEN_MESSAGE);
    }

    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const user = await this.users.create({ email: dto.email, name: dto.name, passwordHash });
      return UserResponseDto.fromUser(user);
    } catch (error) {
      // Deux inscriptions simultanées : la contrainte unique tranche.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      throw error;
    }
  }

  /** Vérifie les identifiants ; le même message couvre l'email inconnu et le mauvais mot de passe. */
  async login(dto: LoginDto): Promise<UserResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await this.passwords.verify(dto.password, user?.passwordHash);

    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    return UserResponseDto.fromUser(user);
  }
}
