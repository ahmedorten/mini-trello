import { NodeEnv, LogLevel, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validDbUrl = 'postgresql://user:pass@localhost:5432/CustomerCRM';
  const validJwtSecret = 'a'.repeat(32);

  it('returns defaults for a minimal object with required DATABASE_URL and JWT_ACCESS_SECRET', () => {
    const result = validateEnv({ DATABASE_URL: validDbUrl, JWT_ACCESS_SECRET: validJwtSecret });
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe(NodeEnv.Development);
    expect(result.LOG_LEVEL).toBe(LogLevel.Info);
    expect(result.DATABASE_URL).toBe(validDbUrl);
    expect(result.JWT_ACCESS_TTL).toBe('15m');
    expect(result.JWT_REFRESH_TTL_DAYS).toBe(7);
  });

  it('coerces PORT from string to number', () => {
    const result = validateEnv({
      PORT: '4000',
      DATABASE_URL: validDbUrl,
      JWT_ACCESS_SECRET: validJwtSecret,
    });
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
    const result = validateEnv({ DATABASE_URL: validDbUrl, JWT_ACCESS_SECRET: validJwtSecret });
    expect(result.CORS_ORIGINS).toBeUndefined();
  });

  it('throws when DATABASE_URL is absent', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: validJwtSecret })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('throws when DATABASE_URL is empty string', () => {
    expect(() => validateEnv({ DATABASE_URL: '', JWT_ACCESS_SECRET: validJwtSecret })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('throws when DATABASE_URL is sqlserver scheme', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'sqlserver://localhost;Database=CustomerCRM',
        JWT_ACCESS_SECRET: validJwtSecret,
      }),
    ).toThrow('DATABASE_URL must be a postgresql:// connection string');
  });

  it('accepts postgresql:// scheme', () => {
    const result = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost/db',
      JWT_ACCESS_SECRET: validJwtSecret,
    });
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost/db');
  });

  it('accepts postgres:// short scheme', () => {
    const result = validateEnv({
      DATABASE_URL: 'postgres://user:pass@localhost/db',
      JWT_ACCESS_SECRET: validJwtSecret,
    });
    expect(result.DATABASE_URL).toBe('postgres://user:pass@localhost/db');
  });

  it('throws when JWT_ACCESS_SECRET is absent', () => {
    expect(() => validateEnv({ DATABASE_URL: validDbUrl })).toThrow(
      'JWT_ACCESS_SECRET must be at least 32 characters',
    );
  });

  it('throws when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    expect(() => validateEnv({ DATABASE_URL: validDbUrl, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      'JWT_ACCESS_SECRET must be at least 32 characters',
    );
  });

  it.each(['15m', '900s', '1h', '1d'])('accepts JWT_ACCESS_TTL of %s', (ttl) => {
    const result = validateEnv({
      DATABASE_URL: validDbUrl,
      JWT_ACCESS_SECRET: validJwtSecret,
      JWT_ACCESS_TTL: ttl,
    });
    expect(result.JWT_ACCESS_TTL).toBe(ttl);
  });

  it('throws on a malformed JWT_ACCESS_TTL', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: validDbUrl,
        JWT_ACCESS_SECRET: validJwtSecret,
        JWT_ACCESS_TTL: '15 minutes',
      }),
    ).toThrow('JWT_ACCESS_TTL must look like 15m, 900s, 1h or 1d');
  });

  it('coerces JWT_REFRESH_TTL_DAYS from string to number', () => {
    const result = validateEnv({
      DATABASE_URL: validDbUrl,
      JWT_ACCESS_SECRET: validJwtSecret,
      JWT_REFRESH_TTL_DAYS: '14',
    });
    expect(result.JWT_REFRESH_TTL_DAYS).toBe(14);
  });

  it('throws when JWT_REFRESH_TTL_DAYS is out of range', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: validDbUrl,
        JWT_ACCESS_SECRET: validJwtSecret,
        JWT_REFRESH_TTL_DAYS: '91',
      }),
    ).toThrow('Invalid environment configuration');
  });
});
