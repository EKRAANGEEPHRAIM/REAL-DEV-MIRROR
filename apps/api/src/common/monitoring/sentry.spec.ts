import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { validateEnv } from '../../config/env.validation.js';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter.js';
import { initSentry, reportServerError } from './sentry.js';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  captureException: vi.fn(),
}));
vi.mock('@sentry/node', () => sentry);

describe('Sentry (optionnel)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sans SENTRY_DSN : rien n’est initialisé ni envoyé', () => {
    expect(initSentry(undefined, 'production')).toBe(false);
    reportServerError(new Error('panne'), { method: 'GET', path: '/api/v1/projects' });

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('avec un DSN : sans données personnelles ni traces de performance', () => {
    expect(initSentry('https://key@o1.ingest.sentry.io/42', 'production')).toBe(true);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o1.ingest.sentry.io/42',
        environment: 'production',
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          urlQueryParams: false,
          httpBodies: [],
        },
        tracesSampleRate: 0,
      }),
    );
  });

  it('le filtre envoie les erreurs 5xx, sans la query string, et jamais les 4xx', () => {
    sentry.isInitialized.mockReturnValue(true);
    const filter = new AllExceptionsFilter();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ headersSent: false, status: () => ({ json: vi.fn() }) }),
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/auth/verify-email?token=secret',
          path: '/api/v1/auth/verify-email',
        }),
      }),
    } as unknown as ArgumentsHost;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failure = new Error('connexion perdue');
    filter.catch(failure, host);
    filter.catch(new NotFoundException(), host);

    expect(sentry.captureException).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledWith(failure, {
      tags: { method: 'POST' },
      extra: { path: '/api/v1/auth/verify-email' },
    });
    expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain('secret');
  });

  it('SENTRY_DSN doit être une URL https ; vide = désactivé', () => {
    const base = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_ACCESS_SECRET: 'x'.repeat(40) };
    expect(validateEnv({ ...base, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
    expect(() =>
      validateEnv({ ...base, SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' }),
    ).not.toThrow();
    expect(() => validateEnv({ ...base, SENTRY_DSN: 'pas-une-url' })).toThrow(/SENTRY_DSN/);
  });
});
