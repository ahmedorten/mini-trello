import { z } from 'zod';

export const cardSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Card title is required')
    .max(255, 'Card title must be under 255 characters'),
  description: z.string()
    .max(2000, 'Description must be under 2000 characters')
    .nullable()
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  dueDate: z.string()
    .nullable()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid due date format',
    }),
});

export type CardFields = z.infer<typeof cardSchema>;
