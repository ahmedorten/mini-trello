import { z } from 'zod';

export const columnSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Column title is required')
    .max(100, 'Column title must be under 100 characters'),
});

export type ColumnFields = z.infer<typeof columnSchema>;
