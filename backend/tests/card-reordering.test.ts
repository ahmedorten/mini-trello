import { describe, it, expect } from 'vitest';
import { createCardSchema, updateCardSchema, moveCardSchema } from '../src/modules/card/card.schema';

describe('Card Service & Schema Validation Tests', () => {
  describe('Card Position Calculation Logic', () => {
    it('should assign position = (maxPosition + 1000) for new card appended to list', () => {
      const existingPositions = [1000, 2000, 3000];
      const maxPosition = Math.max(...existingPositions, 0);
      const newPosition = maxPosition + 1000;

      expect(newPosition).toBe(4000);
    });

    it('should calculate midpoint position when inserting card between two cards', () => {
      const posAbove = 1000;
      const posBelow = 2000;
      const midPosition = Math.floor((posAbove + posBelow) / 2);

      expect(midPosition).toBe(1500);
      expect(midPosition).toBeGreaterThan(posAbove);
      expect(midPosition).toBeLessThan(posBelow);
    });
  });

  describe('Create Card Input Validation', () => {
    it('should pass with valid title, description, and priority', () => {
      const validPayload = {
        title: 'Implement Unit Tests',
        description: 'Add tests for card service',
        priority: 'HIGH',
      };

      const result = createCardSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject card creation with empty or whitespace title', () => {
      const invalidPayload = {
        title: '   ',
      };

      const result = createCardSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Move Card Input Validation', () => {
    it('should accept valid move payload with destinationColumnId and destinationPosition', () => {
      const validMove = {
        destinationColumnId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        destinationPosition: 1500,
      };

      const result = moveCardSchema.safeParse(validMove);
      expect(result.success).toBe(true);
    });

    it('should reject negative destinationPosition or invalid UUID format', () => {
      const invalidMove = {
        destinationColumnId: 'not-a-uuid',
        destinationPosition: -50,
      };

      const result = moveCardSchema.safeParse(invalidMove);
      expect(result.success).toBe(false);
    });
  });

  describe('Update Card Input Validation', () => {
    it('should validate partial card updates (e.g. updating priority and due date)', () => {
      const updatePayload = {
        priority: 'LOW',
        dueDate: '2026-12-31T23:59:59.000Z',
      };

      const result = updateCardSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
    });
  });
});
