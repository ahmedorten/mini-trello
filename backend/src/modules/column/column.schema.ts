import { z } from 'zod';

export const createColumnSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name is required')
      .max(100, 'name must be at most 100 characters'),
  })
  .strict();

export const updateColumnSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name must not be empty')
      .max(100, 'name must be at most 100 characters')
      .optional(),
    position: z
      .number()
      .int()
      .min(0, 'position must be non-negative')
      .optional(),
  })
  .strict();

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;

