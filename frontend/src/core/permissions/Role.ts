import { Permission } from './Permission';

export const Role = {
  OWNER: 'owner',
  MEMBER: 'member',
  GUEST: 'guest',
} as const;

export type Role = typeof Role[keyof typeof Role];

export const RolePermissions: Record<Role, readonly Permission[]> = {
  [Role.OWNER]: [
    Permission.VIEW_BOARDS,
    Permission.CREATE_BOARDS,
    Permission.EDIT_BOARDS,
    Permission.DELETE_BOARDS,
    Permission.VIEW_CARDS,
    Permission.CREATE_CARDS,
    Permission.EDIT_CARDS,
    Permission.DELETE_CARDS,
  ],
  [Role.MEMBER]: [
    Permission.VIEW_BOARDS,
    Permission.CREATE_BOARDS,
    Permission.EDIT_BOARDS,
    Permission.VIEW_CARDS,
    Permission.CREATE_CARDS,
    Permission.EDIT_CARDS,
    Permission.DELETE_CARDS,
  ],
  [Role.GUEST]: [
    Permission.VIEW_BOARDS,
    Permission.VIEW_CARDS,
  ],
} as const;
