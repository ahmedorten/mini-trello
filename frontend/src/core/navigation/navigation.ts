import type { Component } from 'vue';
import { HomeIcon, PresentationChartLineIcon } from '@heroicons/vue/24/outline';
import { Permission } from '@/core/permissions/Permission';

export interface NavigationItem {
  id: string;
  title: string;
  icon: Component;
  route: string;
  permission?: Permission;
}

export const navigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: PresentationChartLineIcon,
    route: '/dashboard',
  },
  {
    id: 'boards',
    title: 'Boards',
    icon: HomeIcon,
    route: '/boards',
    permission: Permission.VIEW_BOARDS,
  },
];

export default navigationConfig;
