import { NodeEnv, validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applique les valeurs par défaut quand les variables sont absentes', () => {
    const env = validateEnv({});

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:4200');
  });

  it('convertit PORT en nombre', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('refuse une configuration invalide en nommant la variable fautive', () => {
    expect(() => validateEnv({ PORT: 'abc', NODE_ENV: 'staging' })).toThrow(
      /PORT[\s\S]*NODE_ENV|NODE_ENV[\s\S]*PORT/,
    );
  });
});
