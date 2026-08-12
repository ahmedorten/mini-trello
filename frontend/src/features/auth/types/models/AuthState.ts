import type { UserProfile } from './UserProfile';

export type AuthStatus = 'Unknown' | 'Loading' | 'Authenticated' | 'Unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
}
