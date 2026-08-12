import type { Role } from '@/core/permissions/Role';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role?: Role;
}
