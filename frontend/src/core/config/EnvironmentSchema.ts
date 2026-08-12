import { z } from 'zod';

export const environmentSchema = z.object({
  VITE_API_BASE_URL: z.string().url({ message: 'VITE_API_BASE_URL must be a valid absolute URL' }),
  VITE_APP_ENV: z.string().refine(
    (val) => ['development', 'staging', 'production'].includes(val),
    { message: 'VITE_APP_ENV must be either "development", "staging", or "production"' }
  ) as z.ZodType<'development' | 'staging' | 'production'>,
});

export type Environment = z.infer<typeof environmentSchema>;

let validatedConfig: Environment | null = null;

/**
 * Validates environment variables against the schema and caches the result.
 * Fails fast and throws a boot error if validation fails.
 */
export function validateEnvironment(): Environment {
  if (validatedConfig) return validatedConfig;

  // We map the raw environment variables from import.meta.env
  const rawEnv = {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  };

  const parsed = environmentSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorDetails = JSON.stringify(parsed.error.format(), null, 2);
    console.error('❌ Environment Validation Failure:', errorDetails);
    
    // In browser environment, show a user-friendly UI message before crashing
    if (typeof document !== 'undefined') {
      const container = document.getElementById('app');
      if (container) {
        container.innerHTML = `
          <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 600px; margin: 2rem auto; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 12px; color: #9b2c2c;">
            <h1 style="font-size: 1.5rem; margin-bottom: 1rem; font-weight: 700;">Configuration Error</h1>
            <p style="font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">The application could not start because of invalid environment variables.</p>
            <pre style="background: #fff; padding: 1rem; border-radius: 6px; font-size: 0.8rem; border: 1px solid #fed7d7; overflow-x: auto;">${errorDetails}</pre>
          </div>
        `;
      }
    }
    
    throw new Error('Application bootstrap aborted due to invalid environment variables.');
  }

  validatedConfig = parsed.data;
  return validatedConfig;
}

/**
 * Exposes the validated configuration environment variables.
 */
export function getEnv(): Environment {
  if (!validatedConfig) {
    return validateEnvironment();
  }
  return validatedConfig;
}
