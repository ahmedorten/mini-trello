import type { RouteRecordRaw } from 'vue-router';
import { Permission } from '@/core/permissions/Permission';

export interface AppRouteMeta {
  requiresAuth: boolean;
  guestOnly?: boolean;
  layout: 'app' | 'auth' | 'blank';
  permission?: Permission;
}

declare module 'vue-router' {
  interface RouteMeta extends AppRouteMeta {}
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/features/auth/pages/LoginPage.vue'),
    meta: { layout: 'auth', requiresAuth: false, guestOnly: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/features/auth/pages/RegisterPage.vue'),
    meta: { layout: 'auth', requiresAuth: false, guestOnly: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/features/dashboard/pages/DashboardPage.vue'),
    meta: { layout: 'app', requiresAuth: true },
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/features/search/pages/SearchPage.vue'),
    meta: { layout: 'app', requiresAuth: true },
  },
  {
    path: '/boards',
    name: 'Boards',
    component: () => import('@/features/boards/pages/BoardsPage.vue'),
    meta: { layout: 'app', requiresAuth: true, permission: Permission.VIEW_BOARDS },
  },
  {
    path: '/boards/:id',
    name: 'BoardDetails',
    component: () => import('@/features/boards/pages/BoardDetailsPage.vue'),
    meta: { layout: 'app', requiresAuth: true, permission: Permission.VIEW_BOARDS },
    children: [
      {
        path: 'cards/:cardId',
        name: 'CardDetails',
        component: () => import('@/features/cards/pages/CardDetailsPage.vue'),
        meta: { layout: 'app', requiresAuth: true, permission: Permission.VIEW_BOARDS },
      },
    ],
  },
];

export default routes;
