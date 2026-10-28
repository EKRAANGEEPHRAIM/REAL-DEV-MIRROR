import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import type { ErrorResponseDto } from '../dto/error-response.dto.js';

interface ResolvedError {
  status: number;
  message: string | string[];
  error?: string;
}

/** Codes Prisma traduits en réponses HTTP ; les autres deviennent des 500 journalisées. */
const PRISMA_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Une valeur dépasse la longueur autorisée' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Cette ressource existe déjà' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Référence invalide : l’élément lié n’existe pas',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Ressource introuvable' },
  P2034: { status: HttpStatus.CONFLICT, message: 'Conflit de modification, réessayez' },
};

const DATABASE_UNAVAILABLE = 'Base de données indisponible, réessayez dans un instant';
const INTERNAL_ERROR = 'Une erreur interne est survenue';

/**
 * Filtre global : toutes les erreurs sortent au format ErrorResponseDto
 * `{ statusCode, message, error, path, timestamp }`. Les détails des erreurs 5xx sont
 * journalisés côté serveur et jamais renvoyés au client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const { status, message, error } = resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    if (response.headersSent) return;

    const body: ErrorResponseDto = {
      statusCode: status,
      message,
      error: error ?? STATUS_CODES[status] ?? 'Error',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }
}

export function resolve(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') return { status, message: payload };
    const { message, error } = payload as { message?: string | string[]; error?: string };
    return { status, message: message ?? exception.message, error };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const known = PRISMA_ERRORS[exception.code];
    if (known) return { status: known.status, message: known.message };
    // P1xxx : connexion à la base (Neon en veille, réseau) ; P2028 : aucune connexion
    // disponible à temps pour ouvrir une transaction. Passager dans les deux cas.
    if (exception.code.startsWith('P1') || exception.code === 'P2028') {
      return { status: HttpStatus.SERVICE_UNAVAILABLE, message: DATABASE_UNAVAILABLE };
    }
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return { status: HttpStatus.SERVICE_UNAVAILABLE, message: DATABASE_UNAVAILABLE };
  }

  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_ERROR };
}
