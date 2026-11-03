import type { IncomingMessage, ServerResponse } from 'node:http';
import { NodeEnv, validateEnv } from '../../config/env.validation.js';
import { defaultLogLevel, loggerParams, requestId, requestLogLevel } from './logger.config.js';

const response = (statusCode = 200) => {
  const headers: Record<string, string> = {};
  return {
    statusCode,
    headers,
    setHeader: (name: string, value: string) => (headers[name] = value),
  } as unknown as ServerResponse & { headers: Record<string, string> };
};
const request = (headers: Record<string, string> = {}, url = '/api/v1/projects') =>
  ({ headers, url }) as unknown as IncomingMessage;

interface PinoHttpOptions {
  level: string;
  transport?: { target: string };
  autoLogging: { ignore: (req: IncomingMessage) => boolean };
  redact: { paths: string[] };
}
const pinoHttp = (env: NodeEnv, level?: Parameters<typeof loggerParams>[1]) =>
  loggerParams(env, level).pinoHttp as unknown as PinoHttpOptions;

describe('logs Pino', () => {
  it('niveau par défaut selon l’environnement, LOG_LEVEL prioritaire', () => {
    expect(defaultLogLevel(NodeEnv.Production)).toBe('info');
    expect(defaultLogLevel(NodeEnv.Development)).toBe('debug');
    expect(defaultLogLevel(NodeEnv.Test)).toBe('silent');
    expect(pinoHttp(NodeEnv.Production).level).toBe('info');
    expect(pinoHttp(NodeEnv.Production, 'warn').level).toBe('warn');
  });

  it('JSON en production, sortie lisible (pino-pretty) en développement seulement', () => {
    expect(pinoHttp(NodeEnv.Production)).not.toHaveProperty('transport');
    expect(pinoHttp(NodeEnv.Test)).not.toHaveProperty('transport');
    expect(pinoHttp(NodeEnv.Development).transport).toMatchObject({ target: 'pino-pretty' });
  });

  it('masque jetons, cookies et mots de passe', () => {
    expect(pinoHttp(NodeEnv.Production).redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
      ]),
    );
  });

  it('ne journalise pas les sondes /health', () => {
    const { ignore } = pinoHttp(NodeEnv.Production).autoLogging;
    expect(ignore(request({}, '/api/v1/health'))).toBe(true);
    expect(ignore(request({}, '/api/v1/projects'))).toBe(false);
  });

  it('identifiant de requête : repris s’il est sain, sinon généré, et renvoyé au client', () => {
    const res = response();
    expect(requestId(request({ 'x-request-id': 'render-abc-123456' }), res)).toBe(
      'render-abc-123456',
    );
    expect(res.headers['x-request-id']).toBe('render-abc-123456');

    const forged = requestId(request({ 'x-request-id': 'x\n{"admin":true}' }), response());
    expect(forged).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId(request(), response())).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('niveau de la ligne de requête selon le statut', () => {
    const req = request();
    expect(requestLogLevel(req, response(200))).toBe('info');
    expect(requestLogLevel(req, response(404))).toBe('warn');
    expect(requestLogLevel(req, response(503))).toBe('error');
    expect(requestLogLevel(req, response(200), new Error('coupure'))).toBe('error');
  });

  it('LOG_LEVEL invalide : l’API refuse de démarrer', () => {
    const base = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_ACCESS_SECRET: 'x'.repeat(40) };
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'debug' })).not.toThrow();
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });
});
