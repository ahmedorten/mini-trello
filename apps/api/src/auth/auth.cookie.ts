import type { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'crm_refresh';

/**
 * `path` is scoped to the auth routes so the long-lived credential is not
 * attached to every API request. `sameSite: 'lax'` is correct for the dev
 * setup, where the Vite proxy makes the browser see one origin — a deployment
 * that serves the SPA from a different site must switch to 'none' with
 * `secure: true`, or the browser will drop the cookie on refresh.
 */
export function refreshCookieOptions(expiresAt: Date, isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/api/auth',
    expires: expiresAt,
  };
}

export function clearedRefreshCookieOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/api/auth' };
}
