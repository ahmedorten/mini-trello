import { z } from 'zod';

export const createLabelSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(50, 'Name must be at most 50 characters'),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/, 'Color must be a valid hex color code')
      .transform((val) => val.toLowerCase()),
  })
  .strict();

export const updateLabelSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name must not be empty')
      .max(50, 'Name must be at most 50 characters')
      .optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/, 'Color must be a valid hex color code')
      .transform((val) => val.toLowerCase())
      .optional(),
  })
  .strict();

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
