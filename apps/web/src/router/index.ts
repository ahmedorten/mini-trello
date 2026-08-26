import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { i18n } from '@/i18n';

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: string;
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
    meta: { titleKey: 'nav.dashboard' },
  },
  {
    path: '/system-status',
    name: 'system-status',
    component: () => import('@/views/SystemStatusView.vue'),
    meta: { titleKey: 'nav.systemStatus' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { titleKey: 'route.title.signIn', public: true },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { titleKey: 'nav.users', permissions: ['users:read'] },
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('@/views/CustomersView.vue'),
    meta: { titleKey: 'nav.customers', permissions: ['customers:read'] },
  },
  {
    path: '/customers/new',
    name: 'customer-create',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { titleKey: 'route.title.newCustomer', permissions: ['customers:write'] },
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: () => import('@/views/CustomerDetailView.vue'),
    meta: { titleKey: 'route.title.customer', permissions: ['customers:read'] },
  },
  {
    path: '/customers/:id/edit',
    name: 'customer-edit',
    component: () => import('@/views/CustomerFormView.vue'),
    meta: { titleKey: 'route.title.editCustomer', permissions: ['customers:write'] },
  },
  {
    path: '/tickets',
    name: 'tickets',
    component: () => import('@/views/TicketsView.vue'),
    meta: { titleKey: 'nav.tickets', permissions: ['tickets:read'] },
  },
  {
    path: '/tickets/new',
    name: 'ticket-create',
    component: () => import('@/views/TicketFormView.vue'),
    meta: { titleKey: 'route.title.newTicket', permissions: ['tickets:write'] },
  },
  {
    path: '/tickets/:id',
    name: 'ticket-detail',
    component: () => import('@/views/TicketDetailView.vue'),
    meta: { titleKey: 'route.title.ticket', permissions: ['tickets:read'] },
  },
  {
    path: '/tickets/:id/edit',
    name: 'ticket-edit',
    component: () => import('@/views/TicketFormView.vue'),
    meta: { titleKey: 'route.title.editTicket', permissions: ['tickets:write'] },
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { titleKey: 'route.title.notAllowed' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { titleKey: 'route.title.notFound' },
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
  const appName = i18n.global.t('app.name');
  const titleKey = to.meta.titleKey;
  document.title = titleKey ? `${i18n.global.t(titleKey)} · ${appName}` : appName;
});

export default router;
