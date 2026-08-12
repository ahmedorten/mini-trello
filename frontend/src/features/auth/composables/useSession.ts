import { computed } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { AuthService } from '../services/auth.service';
import { SessionManager } from '@/core/auth/SessionManager';

export function useSession() {
  const authStore = useAuthStore();

  const status = computed(() => authStore.status);
  const user = computed(() => authStore.user);
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isLoading = computed(() => authStore.isLoading);

  const restoreSession = async () => {
    await AuthService.restoreSession();
  };

  const logout = async () => {
    await AuthService.logout();
  };

  const hasToken = () => {
    return SessionManager.isAuthenticated();
  };

  return {
    status,
    user,
    isAuthenticated,
    isLoading,
    restoreSession,
    logout,
    hasToken,
  };
}

export default useSession;
