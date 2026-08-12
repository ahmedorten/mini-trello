import type { AxiosResponse } from 'axios';
import { handleAxiosError } from '@/core/errors/error-handler';
import { SessionManager } from '@/core/auth/SessionManager';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { router } from '@/router';
import { NotificationCenter } from '@/shared/services/NotificationCenter';

export function responseSuccessInterceptor(response: AxiosResponse): AxiosResponse {
  return response;
}

export async function responseErrorInterceptor(error: any): Promise<never> {
  // Handle Unauthorized 401 response and run unauthorized redirect flow
  if (error.response?.status === 401) {
    SessionManager.clearSession();

    try {
      const authStore = useAuthStore();
      authStore.reset();
    } catch (e) {
      console.warn('Failed to reset AuthStore in interceptor', e);
    }

    // Avoid redirect loops if already on login page
    if (router.currentRoute.value.name !== 'Login' && router.currentRoute.value.name !== 'Register') {
      router.push('/login');
      NotificationCenter.toast('Session expired. Please log in again.', 'error');
    }
  }

  return Promise.reject(handleAxiosError(error));
}
