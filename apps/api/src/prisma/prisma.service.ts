import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Client Prisma unique de l'API, connecté à Neon par l'URL poolée. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaNeon({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
      // Par défaut, une transaction interactive abandonne après 2 s d'attente d'une connexion
      // (P2028) : trop court quand Neon sort de veille ou que les requêtes s'accumulent.
      transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
