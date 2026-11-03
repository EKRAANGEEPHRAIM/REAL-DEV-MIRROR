import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger, SWAGGER_PATH } from './app.setup.js';
import { initSentry } from './common/monitoring/sentry.js';
import { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  // Logs du démarrage mis en attente puis écrits par Pino, comme tous les autres.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  if (
    initSentry(config.get('SENTRY_DSN', { infer: true }), config.get('NODE_ENV', { infer: true }))
  ) {
    Logger.log('Erreurs serveur envoyées à Sentry', 'Bootstrap');
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API prête sur http://localhost:${port} — Swagger : /${SWAGGER_PATH}`, 'Bootstrap');
}
await bootstrap();
