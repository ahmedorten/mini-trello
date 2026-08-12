import { z } from 'zod';

export const createChecklistSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title is required')
      .max(255, 'title must be at most 255 characters'),
  })
  .strict();

export const updateChecklistSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title must not be empty')
      .max(255, 'title must be at most 255 characters'),
  })
  .strict();

export const createChecklistItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title is required')
      .max(255, 'title must be at most 255 characters'),
  })
  .strict();

export const updateChecklistItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title must not be empty')
      .max(255, 'title must be at most 255 characters')
      .optional(),
    isCompleted: z.boolean().optional(),
  })
  .strict();

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
