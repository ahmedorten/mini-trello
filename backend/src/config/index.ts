import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.string().default('info'),
  JWT_SECRET: z.string().default('default-jwt-secret-key-change-me'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  MAX_FILENAME_LENGTH: z.coerce.number().default(255),
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  ALLOWED_MIMETYPES: z
    .string()
    .default('image/jpeg,image/png,image/gif,application/pdf,text/plain'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Use console.error during bootstrap only for critical configuration failures before process termination
  console.error(
    '❌ Configuration validation failed:',
    JSON.stringify(parsedEnv.error.format(), null, 2)
  );
  process.exit(1);
}

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  logLevel: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  maxFilenameLength: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export const config: AppConfig = {
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  logLevel: parsedEnv.data.LOG_LEVEL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  jwtExpiresIn: parsedEnv.data.JWT_EXPIRES_IN,
  maxFilenameLength: parsedEnv.data.MAX_FILENAME_LENGTH,
  maxFileSize: parsedEnv.data.MAX_FILE_SIZE,
  allowedMimeTypes: parsedEnv.data.ALLOWED_MIMETYPES.split(',').map((s) => s.trim()),
};

export default config;
