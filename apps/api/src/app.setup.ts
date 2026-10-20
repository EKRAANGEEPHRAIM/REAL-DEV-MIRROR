import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ErrorResponseDto } from './common/dto/error-response.dto.js';
import { PaginationMetaDto } from './common/dto/paginated-response.dto.js';
import { EnvironmentVariables } from './config/env.validation.js';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

/** Sécurité, préfixe et validation ; partagé par `main.ts` et les tests e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  if (config.get('TRUST_PROXY', { infer: true })) {
    // Derrière Vercel puis Render : req.ip devient l'IP du client (X-Forwarded-For),
    // indispensable pour que la limitation de débit compte par utilisateur et non par proxy.
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }
  app.use(helmet());
  // Lit le cookie httpOnly du refresh token (routes /api/v1/auth).
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

/** Métadonnées du document OpenAPI, partagées par Swagger UI et l'export du client (openapi.ts). */
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('DevMirror API')
    .setDescription('API REST de DevMirror : projets, tâches, objectifs, notes et statistiques.')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('dm_refresh')
    .build();
}

/** Document OpenAPI complet, avec les modèles communs (erreurs, pagination) utilisés par le client. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildOpenApiConfig(), {
    extraModels: [ErrorResponseDto, PaginationMetaDto],
  });
}

/** Documentation OpenAPI sur /api/docs (JSON sur /api/docs-json). */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, createOpenApiDocument(app));
}
