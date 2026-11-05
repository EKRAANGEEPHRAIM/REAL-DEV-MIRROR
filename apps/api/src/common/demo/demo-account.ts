import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

/**
 * Compte de démo du portfolio : identifiants publics, données recréées par le seed
 * (`pnpm --filter @devmirror/api seed:demo`). Les visiteurs peuvent tout essayer sur les
 * projets, tâches, objectifs et notes, mais rien qui gênerait le visiteur suivant :
 * mot de passe, suppression, profil public, avatar, déconnexion de toutes les sessions.
 */
export const DEMO_EMAIL = 'demo@devmirror.dev';
export const DEMO_RESTRICTED_MESSAGE = 'Action désactivée sur le compte de démo';

export function isDemoAccount(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === DEMO_EMAIL;
}

@Injectable()
export class DemoAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (isDemoAccount(user?.email)) throw new ForbiddenException(DEMO_RESTRICTED_MESSAGE);
    return true;
  }
}

/** Route interdite au compte de démo (403), documentée dans Swagger. */
export const DemoRestricted = () =>
  applyDecorators(
    UseGuards(DemoAccountGuard),
    ApiForbiddenResponse({ type: ErrorResponseDto, description: DEMO_RESTRICTED_MESSAGE }),
  );
