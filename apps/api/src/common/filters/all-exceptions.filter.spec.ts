import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Erreur ${code}`, {
    code,
    clientVersion: '7.10.0',
  });
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status, headersSent: false };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/projects/42' }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => vi.clearAllMocks());

  function handle(exception: unknown) {
    filter.catch(exception, host);
    return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
  }

  it('garde le statut et le message d’une HttpException, au format commun', () => {
    const { status: code, body } = handle(new NotFoundException('Projet introuvable'));

    expect(code).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      message: 'Projet introuvable',
      error: 'Not Found',
      path: '/api/v1/projects/42',
      timestamp: expect.any(String),
    });
  });

  it('conserve la liste des messages de validation', () => {
    const { body } = handle(new BadRequestException(['Adresse email invalide', 'Nom trop court']));

    expect(body.message).toEqual(['Adresse email invalide', 'Nom trop court']);
    expect(body.error).toBe('Bad Request');
  });

  it('garde le message français du limiteur (429)', () => {
    const { status: code, body } = handle(new ThrottlerException('Trop de tentatives'));

    expect(code).toBe(429);
    expect(body.message).toBe('Trop de tentatives');
  });

  it.each([
    ['P2002', 409, 'Cette ressource existe déjà'],
    ['P2025', 404, 'Ressource introuvable'],
    ['P2003', 400, 'Référence invalide : l’élément lié n’existe pas'],
    ['P1001', 503, 'Base de données indisponible, réessayez dans un instant'],
    ['P2028', 503, 'Base de données indisponible, réessayez dans un instant'],
  ])('traduit l’erreur Prisma %s en %i', (code, expectedStatus, message) => {
    const { status: received, body } = handle(prismaError(code));

    expect(received).toBe(expectedStatus);
    expect(body.message).toBe(message);
  });

  it('renvoie un 500 générique sans fuite de détail pour une erreur inattendue', () => {
    const { status: code, body } = handle(new Error('mot de passe SQL : secret123'));

    expect(code).toBe(500);
    expect(body.message).toBe('Une erreur interne est survenue');
    expect(JSON.stringify(body)).not.toContain('secret123');
  });
});
