import { CardPriority } from '@prisma/client';
import { z } from 'zod';

export const createCardSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title is required')
      .max(255, 'title must be at most 255 characters'),
    description: z
      .string()
      .trim()
      .max(2000, 'description must be at most 2000 characters')
      .transform((val) => (val === '' ? null : val))
      .nullish(),
    dueDate: z.coerce.date().optional(),
    priority: z.nativeEnum(CardPriority).optional(),
  })
  .strict();

export const updateCardSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title must not be empty')
      .max(255, 'title must be at most 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, 'description must be at most 2000 characters')
      .transform((val) => (val === '' ? null : val))
      .nullish(),
    dueDate: z.coerce.date().nullable().optional(),
    priority: z.nativeEnum(CardPriority).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const moveCardSchema = z
  .object({
    destinationColumnId: z.string().uuid('destinationColumnId must be a valid UUID'),
    destinationPosition: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
