import { describe, it, expect } from 'vitest';
import { createBoardSchema, updateBoardSchema } from '../src/modules/board/board.schema';
import { createColumnSchema } from '../src/modules/column/column.schema';
import { AppError } from '../src/shared/errors/app-error';

describe('API Validation & Error Utilities', () => {
  describe('Board Input Schemas', () => {
    it('should validate board creation payload with valid name', () => {
      const validPayload = {
        name: 'Sprint 24 Kanban',
        description: 'Main sprint tracking board',
      };

      const result = createBoardSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject board creation when name is empty or exceeds length', () => {
      const emptyPayload = { name: '' };
      const longPayload = { name: 'A'.repeat(101) };

      expect(createBoardSchema.safeParse(emptyPayload).success).toBe(false);
      expect(createBoardSchema.safeParse(longPayload).success).toBe(false);
    });

    it('should allow partial update of board name or description', () => {
      const updatePayload = { name: 'Renamed Board' };
      const result = updateBoardSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
    });
  });

  describe('Column Input Schemas', () => {
    it('should validate column creation with name', () => {
      const validColumn = {
        name: 'In Review',
      };

      const result = createColumnSchema.safeParse(validColumn);
      expect(result.success).toBe(true);
    });

    it('should reject empty column name', () => {
      const invalidColumn = {
        name: '   ',
      };

      const result = createColumnSchema.safeParse(invalidColumn);
      expect(result.success).toBe(false);
    });
  });

  describe('AppError Custom Error Class', () => {
    it('should correctly format status code and message', () => {
      const error = new AppError('Board not found', 404);

      expect(error.message).toBe('Board not found');
      expect(error.statusCode).toBe(404);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
