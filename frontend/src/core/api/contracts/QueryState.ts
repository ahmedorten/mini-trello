export const QueryState = {
  Idle: 'Idle',
  Loading: 'Loading',
  Refreshing: 'Refreshing',
  Success: 'Success',
  Error: 'Error',
} as const;

export type QueryState = typeof QueryState[keyof typeof QueryState];
