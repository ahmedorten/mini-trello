/**
 * The access token lives here and nowhere else — a module variable, wiped on
 * page unload by the browser itself. Never persisted: localStorage and
 * sessionStorage are readable by any injected script, which would defeat the
 * httpOnly refresh cookie the backend went to the trouble of setting.
 */
let accessToken: string | null = null;

let handlers: SessionHandlers | null = null;

export interface SessionHandlers {
  /** Resolves to a fresh access token, or null when the session is gone. */
  refresh: () => Promise<string | null>;
  /** Clears client state after an unrecoverable 401. */
  onSessionLost: () => void;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called once by useAuthStore so the interceptor can reach the store's logic. */
export function registerSessionHandlers(next: SessionHandlers): void {
  handlers = next;
}

export function getSessionHandlers(): SessionHandlers | null {
  return handlers;
}

/** Test-only reset. */
export function resetSession(): void {
  accessToken = null;
  handlers = null;
}
