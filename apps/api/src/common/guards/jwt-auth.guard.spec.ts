import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '../auth/auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'secret-de-test-assez-long-0123456789abcdef' });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector, jwt);

  function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  afterEach(() => vi.restoreAllMocks());

  it('laisse passer une route @Public() sans jeton', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });

  it('accepte un jeton valide et expose l’utilisateur sur la requête', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', email: 'ada@devmirror.dev' });
    const request = { headers: { authorization: `Bearer ${token}` } } as AuthenticatedRequest;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'ada@devmirror.dev' });
  });

  it.each([
    ['sans en-tête', {}],
    ['avec un autre schéma', { authorization: 'Basic abc' }],
    ['avec un jeton falsifié', { authorization: 'Bearer pas.un.jwt' }],
  ])('refuse une requête %s', async (_cas, headers) => {
    await expect(guard.canActivate(contextFor({ headers }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const forged = await new JwtService({
      secret: 'un-autre-secret-de-32-caracteres-xx',
    }).signAsync({
      sub: 'user-1',
      email: 'ada@devmirror.dev',
    });

    await expect(
      guard.canActivate(contextFor({ headers: { authorization: `Bearer ${forged}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
