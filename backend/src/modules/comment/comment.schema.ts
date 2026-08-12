import { z } from 'zod';

export const createCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, 'content is required')
      .max(2000, 'content must be at most 2000 characters'),
  })
  .strict();

export const updateCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, 'content must not be empty')
      .max(2000, 'content must be at most 2000 characters'),
  })
  .strict();

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
