import { z } from 'zod';

export const boardSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Board name is required')
    .max(100, 'Board name must be under 100 characters'),
  description: z.string()
    .trim()
    .max(500, 'Description must be under 500 characters')
    .optional(),
});

export type BoardFields = z.infer<typeof boardSchema>;
