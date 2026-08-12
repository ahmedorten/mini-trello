import { z } from 'zod';

export const commentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Comment text cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters'),
});

export type CommentFields = z.infer<typeof commentSchema>;
