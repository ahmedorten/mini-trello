import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const cardTitleSchema = z
  .string()
  .trim()
  .min(1, 'Card title is required')
  .max(255, 'Card title is too long');

const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

describe('Frontend Form Validation & Input Sanitization Tests', () => {
  describe('Card Title Validation', () => {
    it('should accept valid non-empty titles', () => {
      expect(cardTitleSchema.safeParse('Implement Drag & Drop').success).toBe(true);
    });

    it('should reject empty or whitespace-only card titles', () => {
      expect(cardTitleSchema.safeParse('').success).toBe(false);
      expect(cardTitleSchema.safeParse('   ').success).toBe(false);
    });

    it('should trim leading and trailing spaces', () => {
      const parsed = cardTitleSchema.parse('   Clean Architecture   ');
      expect(parsed).toBe('Clean Architecture');
    });
  });

  describe('User Registration & Authentication Input Validation', () => {
    it('should validate valid email address', () => {
      expect(emailSchema.safeParse('developer@trello.app').success).toBe(true);
    });

    it('should reject malformed email addresses', () => {
      expect(emailSchema.safeParse('developer@trello').success).toBe(false);
      expect(emailSchema.safeParse('developer.trello.app').success).toBe(false);
    });

    it('should validate password length requirements', () => {
      expect(passwordSchema.safeParse('SuperSecret123!').success).toBe(true);
      expect(passwordSchema.safeParse('12345').success).toBe(false);
    });
  });
});
