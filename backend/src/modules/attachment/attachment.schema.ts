import { z } from 'zod';
import config from '../../config';

export const updateAttachmentSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, 'fileName must not be empty')
      .max(
        config.maxFilenameLength,
        `fileName must be at most ${config.maxFilenameLength} characters`
      ),
  })
  .strict();

export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
