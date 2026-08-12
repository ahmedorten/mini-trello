import { z } from 'zod';

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const parsedDatabaseEnv = databaseEnvSchema.safeParse(process.env);

if (!parsedDatabaseEnv.success) {
  // Use console.error during bootstrap only for critical configuration failures before process termination
  console.error(
    '❌ Database configuration validation failed:',
    JSON.stringify(parsedDatabaseEnv.error.format(), null, 2)
  );
  process.exit(1);
}

export interface DatabaseConfig {
  url: string;
}

export const databaseConfig: DatabaseConfig = {
  url: parsedDatabaseEnv.data.DATABASE_URL,
};

export default databaseConfig;
