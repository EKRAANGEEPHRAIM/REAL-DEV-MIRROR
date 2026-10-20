import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        // 100 requêtes par minute et par IP sur toute l'API ; les routes d'auth sont plus strictes.
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        errorMessage: 'Trop de tentatives, réessayez dans une minute',
        skipIf: () => !config.get('RATE_LIMIT_ENABLED', { infer: true }),
      }),
    }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Format d'erreur unique et traduction des erreurs Prisma (voir AllExceptionsFilter).
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
