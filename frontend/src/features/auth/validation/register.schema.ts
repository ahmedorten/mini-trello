import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be under 100 characters'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long'),
});

export type RegisterFields = z.infer<typeof registerSchema>;
