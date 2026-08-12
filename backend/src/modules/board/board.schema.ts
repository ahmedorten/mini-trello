import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
  description: z.string().max(500, 'description must be at most 500 characters').optional(),
});

export const updateBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'name must not be empty')
    .max(100, 'name must be at most 100 characters')
    .optional(),
  description: z.string().max(500, 'description must be at most 500 characters').optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
