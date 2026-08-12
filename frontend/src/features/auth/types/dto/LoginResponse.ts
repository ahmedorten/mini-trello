import type { UserProfile } from '../models/UserProfile';

export interface LoginResponse {
  token: string;
  user: UserProfile;
}
