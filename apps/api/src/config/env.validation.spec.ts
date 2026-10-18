import { NodeEnv, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgresql://user:secret@ep-test-pooler.eu.aws.neon.tech/neondb';
const JWT_ACCESS_SECRET = 'un-secret-de-test-suffisamment-long-0123456789';
const required = { DATABASE_URL, JWT_ACCESS_SECRET };

describe('validateEnv', () => {
  it('applique les valeurs par défaut quand les variables facultatives sont absentes', () => {
    const env = validateEnv(required);

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:4200');
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('convertit PORT en nombre', () => {
    expect(validateEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('retire les guillemets copiés autour de DATABASE_URL', () => {
    expect(validateEnv({ ...required, DATABASE_URL: ` "${DATABASE_URL}" ` }).DATABASE_URL).toBe(
      DATABASE_URL,
    );
  });

  it('exige DATABASE_URL et JWT_ACCESS_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET/);
  });

  it('refuse un secret JWT trop court', () => {
    expect(() => validateEnv({ ...required, JWT_ACCESS_SECRET: 'court' })).toThrow(
      /JWT_ACCESS_SECRET doit contenir au moins 32 caractères/,
    );
  });

  it('refuse une configuration invalide en nommant la variable fautive', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc', NODE_ENV: 'staging' })).toThrow(
      /PORT[\s\S]*NODE_ENV|NODE_ENV[\s\S]*PORT/,
    );
  });
});
