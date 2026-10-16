import { Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

/** Accès aux comptes ; les emails sont toujours comparés normalisés (minuscules, sans espaces). */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: normalizeEmail(data.email), name: data.name.trim() },
    });
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
