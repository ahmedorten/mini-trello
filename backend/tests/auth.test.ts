import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { registerSchema, loginSchema } from '../src/modules/auth/auth.schema';

const JWT_SECRET = 'test-secret-key-12345';

describe('Auth Module - Security & Validation Unit Tests', () => {
  describe('Password Hashing (bcrypt)', () => {
    it('should correctly hash a password and verify matching plain text', async () => {
      const plainPassword = 'Password123!';
      const saltRounds = 10;
      const hash = await bcrypt.hash(plainPassword, saltRounds);

      expect(hash).not.toBe(plainPassword);
      const isMatch = await bcrypt.compare(plainPassword, hash);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password comparison', async () => {
      const plainPassword = 'Password123!';
      const wrongPassword = 'WrongPassword999!';
      const hash = await bcrypt.hash(plainPassword, 10);

      const isMatch = await bcrypt.compare(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });
  });

  describe('JWT Token Handling', () => {
    it('should sign and verify a valid user payload', () => {
      const payload = { userId: '12345-uuid-67890', email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      expect(token).toBeTypeOf('string');

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('should throw error when verifying token with invalid secret', () => {
      const payload = { userId: '12345-uuid-67890' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });
  });

  describe('Registration Input Validation Schema', () => {
    it('should validate a correct registration payload', () => {
      const validPayload = {
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
      };

      const result = registerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format during registration', () => {
      const invalidPayload = {
        fullName: 'Jane Doe',
        email: 'not-an-email',
        password: 'SecurePassword123!',
      };

      const result = registerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const invalidPayload = {
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'short',
      };

      const result = registerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Login Input Validation Schema', () => {
    it('should validate a correct login payload', () => {
      const validPayload = {
        email: 'user@example.com',
        password: 'Password123!',
      };

      const result = loginSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject empty login email or password', () => {
      const invalidPayload = {
        email: '',
        password: '',
      };

      const result = loginSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
