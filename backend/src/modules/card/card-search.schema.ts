import { CardPriority } from '@prisma/client';
import { z } from 'zod';

const queryBoolean = z
  .preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean())
  .optional();

export const cardSearchSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : undefined)),
  boardId: z.string().uuid().optional(),
  columnId: z.string().uuid().optional(),
  priority: z.nativeEnum(CardPriority).optional(),
  labelId: z.string().uuid().optional(),
  hasAttachments: queryBoolean,
  hasComments: queryBoolean,
  hasChecklist: queryBoolean,
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  isArchived: queryBoolean,
  sort: z
    .enum(['title', 'createdAt', 'updatedAt', 'priority', 'dueDate', 'position'])
    .default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CardSearchInput = z.infer<typeof cardSearchSchema>;
