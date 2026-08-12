import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_APP_ENV: z.enum(['development', 'local', 'staging', 'production']),
});

const parsedEnv = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
});

export const AppConfig = {
  apiBaseUrl: parsedEnv.VITE_API_BASE_URL,
  appEnv: parsedEnv.VITE_APP_ENV,
} as const;

export type AppConfigType = typeof AppConfig;
