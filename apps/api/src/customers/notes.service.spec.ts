import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerStatus } from '@prisma/client';
import { NotesService } from './notes.service';
import { ARCHIVE_PERMISSION, CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseNoteRow = {
  id: 'note-1',
  customerId: 'customer-1',
  authorId: 'author-1',
  body: 'Called the customer back.',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  author: { id: 'author-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'author-1',
    email: 'nour@crm.local',
    fullName: 'Nour Hassan',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['customers:read', 'notes:write'],
    ...overrides,
  };
}

describe('NotesService', () => {
  let service: NotesService;
  let prisma: {
    customerNote: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let customersService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customerNote: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    customersService = {
      assertExists: jest
        .fn()
        .mockResolvedValue({ id: 'customer-1', status: CustomerStatus.ACTIVE }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  describe('list', () => {
    it('asserts the customer exists, then orders by createdAt descending scoped by customerId', async () => {
      prisma.customerNote.findMany.mockResolvedValue([]);

      await service.list('customer-1');

      expect(customersService.assertExists).toHaveBeenCalledWith('customer-1');
      expect(prisma.customerNote.findMany).toHaveBeenCalledWith(
        containing({ where: { customerId: 'customer-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('create', () => {
    it('trims the body and sets authorId from the caller', async () => {
      const caller = buildCaller();
      prisma.customerNote.create.mockResolvedValue(baseNoteRow);

      await service.create('customer-1', { body: '  hello there  ' }, caller);

      expect(prisma.customerNote.create).toHaveBeenCalledWith(
        containing({ data: containing({ body: 'hello there', authorId: caller.id }) }),
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException for a non-author and never calls update', async () => {
      const caller = buildCaller({ id: 'someone-else' });
      prisma.customerNote.findFirst.mockResolvedValue(baseNoteRow);

      await expect(
        service.update('customer-1', 'note-1', { body: 'edited' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.customerNote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a note from another customer, scoping findFirst by both ids', async () => {
      const caller = buildCaller();
      prisma.customerNote.findFirst.mockResolvedValue(null);

      await expect(
        service.update('customer-1', 'note-1', { body: 'edited' }, caller),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customerNote.findFirst).toHaveBeenCalledWith(
        containing({ where: { id: 'note-1', customerId: 'customer-1' } }),
      );
    });

    it('succeeds for the author', async () => {
      const caller = buildCaller();
      prisma.customerNote.findFirst.mockResolvedValue(baseNoteRow);
      prisma.customerNote.update.mockResolvedValue(baseNoteRow);

      await expect(
        service.update('customer-1', 'note-1', { body: 'edited' }, caller),
      ).resolves.toBeDefined();
    });
  });

  describe('remove', () => {
    it('succeeds for the author', async () => {
      const caller = buildCaller();
      prisma.customerNote.findFirst.mockResolvedValue(baseNoteRow);

      await expect(service.remove('customer-1', 'note-1', caller)).resolves.toBeUndefined();
    });

    it('throws for a stranger without customers:archive', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: ['customers:read'] });
      prisma.customerNote.findFirst.mockResolvedValue(baseNoteRow);

      await expect(service.remove('customer-1', 'note-1', caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('succeeds for a stranger with customers:archive', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: [ARCHIVE_PERMISSION] });
      prisma.customerNote.findFirst.mockResolvedValue(baseNoteRow);

      await expect(service.remove('customer-1', 'note-1', caller)).resolves.toBeUndefined();
    });
  });
});
