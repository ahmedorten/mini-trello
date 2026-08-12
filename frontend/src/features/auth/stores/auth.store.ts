import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserProfile } from '@/features/auth/types/models/UserProfile';
import type { AuthStatus } from '@/features/auth/types/models/AuthState';

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('Unknown');
  const user = ref<UserProfile | null>(null);

  const isAuthenticated = computed(() => status.value === 'Authenticated');
  const isLoading = computed(() => status.value === 'Loading');

  const setAuthenticated = (profile: UserProfile) => {
    user.value = profile;
    status.value = 'Authenticated';
  };

  const setStatus = (newStatus: AuthStatus) => {
    status.value = newStatus;
  };

  const reset = () => {
    user.value = null;
    status.value = 'Unauthenticated';
  };

  return {
    status,
    user,
    isAuthenticated,
    isLoading,
    setAuthenticated,
    setStatus,
    reset,
  };
});
