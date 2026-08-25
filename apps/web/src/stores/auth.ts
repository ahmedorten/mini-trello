import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  type AuthUser,
} from '@/api/auth';
import { toErrorMessage } from '@/api/client';
import { getAccessToken, registerSessionHandlers, setAccessToken } from '@/api/session';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isRestored = ref(false);

  /**
   * The single in-flight refresh. Story 06 rotates the refresh token and
   * revokes EVERY session when a consumed token is replayed, so two parallel
   * refreshes would log the user out. Every caller awaits this one promise.
   */
  let refreshInFlight: Promise<string | null> | null = null;

  const isAuthenticated = computed(() => user.value !== null);

  function can(permission: string): boolean {
    return user.value?.permissions.includes(permission) ?? false;
  }

  function canAny(...permissions: string[]): boolean {
    return permissions.some((permission) => can(permission));
  }

  function clear(): void {
    setAccessToken(null);
    user.value = null;
  }

  async function refresh(): Promise<string | null> {
    refreshInFlight ??= (async () => {
      try {
        const tokens = await refreshSession();
        setAccessToken(tokens.accessToken);

        return tokens.accessToken;
      } catch {
        clear();

        return null;
      } finally {
        // Cleared in `finally` so the NEXT expiry starts a fresh refresh
        // rather than resolving instantly from a stale promise.
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  async function login(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const tokens = await loginRequest(email, password);
      setAccessToken(tokens.accessToken);
      user.value = await fetchCurrentUser();

      return true;
    } catch (caught) {
      clear();
      error.value = toErrorMessage(caught);

      return false;
    } finally {
      isLoading.value = false;
      isRestored.value = true;
    }
  }

  /**
   * Called once before the app mounts. Trades the httpOnly cookie for an access
   * token. A failure is the normal signed-out case — it must never surface an
   * error to the user.
   */
  async function restore(): Promise<void> {
    if (isRestored.value) {
      return;
    }

    try {
      const token = await refresh();

      if (token) {
        user.value = await fetchCurrentUser();
      }
    } catch {
      clear();
    } finally {
      isRestored.value = true;
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch {
      // A failed server-side logout must not strand the user in a signed-in
      // UI. Clear locally regardless; the refresh token expires on its own.
    } finally {
      clear();
      error.value = null;
    }
  }

  registerSessionHandlers({ refresh, onSessionLost: clear });

  return {
    user,
    isLoading,
    error,
    isRestored,
    isAuthenticated,
    can,
    canAny,
    login,
    logout,
    refresh,
    restore,
    // Exposed for tests only; components must never read the raw token.
    peekToken: getAccessToken,
  };
});
