export const Permission = {
  VIEW_BOARDS: 'boards:view',
  CREATE_BOARDS: 'boards:create',
  EDIT_BOARDS: 'boards:edit',
  DELETE_BOARDS: 'boards:delete',

  VIEW_CARDS: 'cards:view',
  CREATE_CARDS: 'cards:create',
  EDIT_CARDS: 'cards:edit',
  DELETE_CARDS: 'cards:delete',
} as const;

export type Permission = typeof Permission[keyof typeof Permission];
