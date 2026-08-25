import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** Reachable without a session. Everything else requires one. */
    public?: boolean;
    /** Permission keys the caller needs. Advisory — the API is the authority. */
    permissions?: string[];
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard' },
  },
  {
    path: '/system-status',
    name: 'system-status',
    component: () => import('@/views/SystemStatusView.vue'),
    meta: { title: 'System status' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign in', public: true },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { title: 'Users', permissions: ['users:read'] },
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('@/views/CustomersView.vue'),
    meta: { title: 'Customers', permissions: ['customers:read'] },
  },
  {
    path: '/customers/new',
    name: 'customer-create',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { title: 'New customer', permissions: ['customers:write'] },
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: () => import('@/views/CustomerDetailView.vue'),
    meta: { title: 'Customer', permissions: ['customers:read'] },
  },
  {
    path: '/customers/:id/edit',
    name: 'customer-edit',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { title: 'Edit customer', permissions: ['customers:write'] },
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: 'Not allowed' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Not found' },
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // First navigation after a hard reload can arrive before main.ts finished
  // restoring. Awaiting here makes the guard correct on its own, independent of
  // the bootstrap order.
  if (!auth.isRestored) {
    await auth.restore();
  }

  if (to.meta.public) {
    // A signed-in user has no business on the sign-in page.
    return auth.isAuthenticated ? { name: 'dashboard' } : true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const required = to.meta.permissions ?? [];

  if (required.length > 0 && !required.every((permission) => auth.can(permission))) {
    return { name: 'forbidden' };
  }

  return true;
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'Customer Support CRM';
  document.title = `${title} · Customer Support CRM`;
});

export default router;
