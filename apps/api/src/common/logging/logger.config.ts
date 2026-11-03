import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { type LogLevel, NodeEnv } from '../../config/env.validation.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Jamais dans les logs : jetons d'accès, cookie de refresh, mots de passe. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
];

export function defaultLogLevel(env: NodeEnv): LogLevel {
  if (env === NodeEnv.Production) return 'info';
  if (env === NodeEnv.Test) return 'silent';
  return 'debug';
}

/**
 * Identifiant de requête : repris de l'en-tête x-request-id (proxy, client) s'il est sain,
 * sinon généré ; renvoyé dans la réponse pour relier un signalement aux logs.
 */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/** 5xx en erreur, 4xx en avertissement, le reste en info. */
export function requestLogLevel(
  _req: IncomingMessage,
  res: ServerResponse,
  error?: Error,
): LogLevel {
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

/**
 * Logs Pino : JSON d'une ligne en production (lisibles et filtrables dans Render), sortie
 * colorée en développement. Chaque requête est journalisée une fois, avec durée et statut ;
 * les sondes /health ne le sont pas (Render les appelle en continu).
 */
export function loggerParams(env: NodeEnv, level: LogLevel = defaultLogLevel(env)): Params {
  return {
    pinoHttp: {
      level,
      genReqId: requestId,
      customLogLevel: requestLogLevel,
      autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
      redact: { paths: REDACTED_PATHS, censor: '[masqué]' },
      // Requête et réponse réduites à l'utile : pas d'en-têtes complets ni de corps.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      ...(env === NodeEnv.Development && {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
    },
  };
}
