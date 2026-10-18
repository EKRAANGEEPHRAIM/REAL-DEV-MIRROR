import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from '../auth/auth-user.js';

/** Injecte l'utilisateur du jeton d'accès : `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) {
    // Utilisé sur une route @Public() : erreur de programmation, pas d'accès anonyme silencieux.
    throw new UnauthorizedException();
  }
  return user satisfies AuthUser;
});
