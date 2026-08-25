import { NodeEnv, LogLevel, validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('returns defaults for an empty object', () => {
    const result = validateEnv({});
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe(NodeEnv.Development);
    expect(result.LOG_LEVEL).toBe(LogLevel.Info);
  });

  it('coerces PORT from string to number', () => {
    const result = validateEnv({ PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('throws on non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow('Invalid environment configuration');
  });

  it('throws on out-of-range PORT', () => {
    expect(() => validateEnv({ PORT: '99999' })).toThrow('Invalid environment configuration');
  });

  it('throws on unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow('Invalid environment configuration');
  });

  it('throws on unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'verbose' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('accepts missing CORS_ORIGINS', () => {
    const result = validateEnv({});
    expect(result.CORS_ORIGINS).toBeUndefined();
  });
});
