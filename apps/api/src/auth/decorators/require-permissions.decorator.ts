import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'auth:permissions';

/**
 * Requires ALL listed permission keys. Keys must exist in the seeded
 * permissions catalogue (prisma/seed.ts) — a typo here is an endpoint nobody
 * can ever call.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
