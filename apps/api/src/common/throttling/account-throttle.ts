import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { isDemoAccount } from '../demo/demo-account.js';

export interface AccountLimit {
  /** Préfixe de la clé : un compteur par route (« login », « forgot-password »). */
  scope: string;
  limit: number;
  ttl: number;
}

const ACCOUNT_LIMIT = 'devmirror:account-limit';
export const ACCOUNT_LIMIT_MESSAGE = 'Trop de tentatives pour ce compte, réessayez plus tard';

/**
 * Limite par compte (email du corps de la requête), en plus de la limite par IP.
 *
 * Derrière Vercel puis Render, l'IP du client est lue dans X-Forwarded-For, un en-tête que le
 * client peut aussi écrire : changer de valeur à chaque requête contourne une limite par IP.
 * Compter par email borne la force brute sur un compte et le bombardement d'une boîte mail,
 * quelle que soit l'IP annoncée. Le compte de démo (mot de passe public, partagé par les
 * visiteurs) n'est limité que par IP.
 */
@Injectable()
export class AccountThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<AccountLimit | undefined>(
      ACCOUNT_LIMIT,
      context.getHandler(),
    );
    if (!options || !this.config.get('RATE_LIMIT_ENABLED', { infer: true })) return true;

    const http = context.switchToHttp();
    const body = http.getRequest<Request>().body as { email?: unknown } | undefined;
    // Email absent ou mal formé : la validation du corps répondra 400 juste après.
    if (typeof body?.email !== 'string') return true;
    const email = body.email.trim().toLowerCase();
    if (!email || isDemoAccount(email)) return true;

    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      `account:${options.scope}:${email}`,
      options.ttl,
      options.limit,
      options.ttl,
      'account',
    );
    if (!isBlocked) return true;

    http.getResponse<Response>().setHeader('Retry-After', String(timeToBlockExpire));
    throw new HttpException(ACCOUNT_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** `limit` requêtes par fenêtre de `ttl` ms et par email, en plus de la limite par IP. */
export const LimitPerAccount = (options: AccountLimit) =>
  applyDecorators(SetMetadata(ACCOUNT_LIMIT, options), UseGuards(AccountThrottleGuard));
