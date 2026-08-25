import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerStatus, InteractionChannel, InteractionDirection } from '@prisma/client';
import { InteractionsService } from './interactions.service';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseInteractionRow = {
  id: 'interaction-1',
  customerId: 'customer-1',
  createdById: 'author-1',
  channel: InteractionChannel.PHONE,
  direction: InteractionDirection.OUTBOUND,
  subject: 'Follow-up call',
  body: null as string | null,
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:05:00.000Z'),
  createdBy: { id: 'author-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
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
    permissions: ['customers:read', 'interactions:write'],
    ...overrides,
  };
}

describe('InteractionsService', () => {
  let service: InteractionsService;
  let prisma: {
    customerInteraction: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };
  let customersService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customerInteraction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
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
        InteractionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    service = module.get<InteractionsService>(InteractionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dto = {
    channel: InteractionChannel.PHONE,
    direction: InteractionDirection.OUTBOUND,
    subject: 'Follow-up call',
  };

  describe('create', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
      prisma.customerInteraction.create.mockResolvedValue(baseInteractionRow);
    });

    it('succeeds with occurredAt one hour in the past', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T11:00:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).resolves.toBeDefined();
    });

    it('succeeds with occurredAt two minutes ahead (skew tolerance)', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T12:02:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).resolves.toBeDefined();
    });

    it('throws BadRequestException with occurredAt one hour ahead', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T13:00:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('orders by occurredAt then createdAt, both descending', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1');

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }] }),
      );
    });
  });

  it('has no update method — a later addition should trip this test', () => {
    expect((service as unknown as Record<string, unknown>).update).toBeUndefined();
  });
});
