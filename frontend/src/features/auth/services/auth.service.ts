import { AuthApi } from '../api/auth.api';
import { SessionManager } from '@/core/auth/SessionManager';
import { useAuthStore } from '../stores/auth.store';
import type { LoginRequest } from '../types/dto/LoginRequest';
import type { RegisterRequest } from '../types/dto/RegisterRequest';

export class AuthService {
  public static async login(credentials: LoginRequest): Promise<void> {
    const authStore = useAuthStore();
    authStore.setStatus('Loading');

    const result = await AuthApi.login(credentials);
    if (result.success) {
      const { token, user } = result.data;
      SessionManager.saveToken(token);
      SessionManager.saveUser(user);
      authStore.setAuthenticated(user);
    } else {
      authStore.reset();
      throw result.error;
    }
  }

  public static async register(data: RegisterRequest): Promise<void> {
    const authStore = useAuthStore();
    authStore.setStatus('Loading');

    const result = await AuthApi.register(data);
    if (result.success) {
      // Automatically log in the user after successful registration
      await this.login({
        email: data.email,
        password: data.password,
      });
    } else {
      authStore.reset();
      throw result.error;
    }
  }

  public static async logout(): Promise<void> {
    const authStore = useAuthStore();
    SessionManager.clearSession();
    authStore.reset();

    // Reset Search, Filter, and Statistics stores and clear caches
    try {
      const { useSearchStore } = await import('@/features/search/stores/search.store');
      const { useFilterStore } = await import('@/features/filters/stores/filter.store');
      const { useStatisticsStore } = await import('@/features/statistics/stores/statistics.store');
      const { SearchService } = await import('@/features/search/services/search.service');

      useSearchStore().reset();
      useFilterStore().reset();
      useStatisticsStore().reset();
      SearchService.getInstance().clear();
    } catch (e) {
      console.error('Failed to reset search/filter/statistics stores on logout', e);
    }
  }

  public static async restoreSession(): Promise<void> {
    const authStore = useAuthStore();
    authStore.setStatus('Loading');

    const { token } = SessionManager.restoreSession();
    if (!token) {
      authStore.reset();
      return;
    }

    // Call /auth/me to verify token and fetch fresh user profile
    const result = await AuthApi.getMe();
    if (result.success) {
      SessionManager.saveUser(result.data);
      authStore.setAuthenticated(result.data);
    } else {
      // Token is invalid/expired
      SessionManager.clearSession();
      authStore.reset();
    }
  }
}

export default AuthService;
