import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger, SWAGGER_PATH } from './app.setup.js';
import { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  const port = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService).get('PORT', {
    infer: true,
  });
  await app.listen(port);
  Logger.log(`API prête sur http://localhost:${port} — Swagger : /${SWAGGER_PATH}`, 'Bootstrap');
}
await bootstrap();
