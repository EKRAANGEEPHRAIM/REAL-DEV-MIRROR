import { NodeEnv, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgresql://user:secret@ep-test-pooler.eu.aws.neon.tech/neondb';

describe('validateEnv', () => {
  it('applique les valeurs par défaut quand les variables facultatives sont absentes', () => {
    const env = validateEnv({ DATABASE_URL });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:4200');
  });

  it('convertit PORT en nombre', () => {
    expect(validateEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('retire les guillemets copiés autour de DATABASE_URL', () => {
    expect(validateEnv({ DATABASE_URL: ` "${DATABASE_URL}" ` }).DATABASE_URL).toBe(DATABASE_URL);
  });

  it('exige DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuse une configuration invalide en nommant la variable fautive', () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: 'abc', NODE_ENV: 'staging' })).toThrow(
      /PORT[\s\S]*NODE_ENV|NODE_ENV[\s\S]*PORT/,
    );
  });
});
