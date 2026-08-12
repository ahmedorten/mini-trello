import { storage } from '@/core/storage/storage';
import type { UserProfile } from '@/features/auth/types/models/UserProfile';

const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'user_profile';

export const SessionManager = {
  saveToken(token: string): void {
    storage.setItem(TOKEN_KEY, token);
  },

  getToken(): string | null {
    return storage.getItem<string>(TOKEN_KEY);
  },

  removeToken(): void {
    storage.removeItem(TOKEN_KEY);
  },

  saveUser(user: UserProfile): void {
    storage.setItem(USER_KEY, user);
  },

  getUser(): UserProfile | null {
    return storage.getItem<UserProfile>(USER_KEY);
  },

  clearSession(): void {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  },

  restoreSession(): { token: string | null; user: UserProfile | null } {
    const token = this.getToken();
    const user = this.getUser();
    return { token, user };
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export default SessionManager;
