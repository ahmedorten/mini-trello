import { NodeEnv, LogLevel, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validDbUrl = 'postgresql://user:pass@localhost:5432/CustomerCRM';

  it('returns defaults for a minimal object with required DATABASE_URL', () => {
    const result = validateEnv({ DATABASE_URL: validDbUrl });
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe(NodeEnv.Development);
    expect(result.LOG_LEVEL).toBe(LogLevel.Info);
    expect(result.DATABASE_URL).toBe(validDbUrl);
  });

  it('coerces PORT from string to number', () => {
    const result = validateEnv({ PORT: '4000', DATABASE_URL: validDbUrl });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('throws on non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc', DATABASE_URL: validDbUrl })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('throws on out-of-range PORT', () => {
    expect(() => validateEnv({ PORT: '99999', DATABASE_URL: validDbUrl })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('throws on unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging', DATABASE_URL: validDbUrl })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('throws on unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'verbose', DATABASE_URL: validDbUrl })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('accepts missing CORS_ORIGINS', () => {
    const result = validateEnv({ DATABASE_URL: validDbUrl });
    expect(result.CORS_ORIGINS).toBeUndefined();
  });

  it('throws when DATABASE_URL is absent', () => {
    expect(() => validateEnv({})).toThrow('Invalid environment configuration');
  });

  it('throws when DATABASE_URL is empty string', () => {
    expect(() => validateEnv({ DATABASE_URL: '' })).toThrow('Invalid environment configuration');
  });

  it('throws when DATABASE_URL is sqlserver scheme', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'sqlserver://localhost;Database=CustomerCRM' }),
    ).toThrow('DATABASE_URL must be a postgresql:// connection string');
  });

  it('accepts postgresql:// scheme', () => {
    const result = validateEnv({ DATABASE_URL: 'postgresql://user:pass@localhost/db' });
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost/db');
  });

  it('accepts postgres:// short scheme', () => {
    const result = validateEnv({ DATABASE_URL: 'postgres://user:pass@localhost/db' });
    expect(result.DATABASE_URL).toBe('postgres://user:pass@localhost/db');
  });
});
