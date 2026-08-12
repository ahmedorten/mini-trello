import { z } from 'zod';

export const checklistSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be under 255 characters'),
});

export type ChecklistFields = z.infer<typeof checklistSchema>;
