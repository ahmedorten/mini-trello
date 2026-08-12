import { z } from 'zod';

export const boardSearchSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export type BoardSearchInput = z.infer<typeof boardSearchSchema>;
