import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useSession } from '@/features/auth/composables/useSession';
import { PermissionGuard } from '@/core/permissions/PermissionGuard';

export async function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const { status, isAuthenticated, restoreSession, user } = useSession();

  // If session status is Unknown (on application boot), restore the session first
  if (status.value === 'Unknown') {
    try {
      await restoreSession();
    } catch (e) {
      console.error('Session restoration failed during routing', e);
    }
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isGuestOnly = to.matched.some((record) => record.meta.guestOnly);

  if (requiresAuth && !isAuthenticated.value) {
    next({ name: 'Login' });
  } else if (isGuestOnly && isAuthenticated.value) {
    next({ name: 'Dashboard' });
  } else if (requiresAuth && to.meta.permission) {
    // Role/Permission-based checks
    const role = user.value?.role || 'owner';
    if (!PermissionGuard.hasPermission(role, to.meta.permission)) {
      next({ name: 'Dashboard' });
    } else {
      next();
    }
  } else {
    next();
  }
}
