import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CustomerStatus, CustomerType, Prisma } from '@prisma/client';
import { ARCHIVE_PERMISSION, CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { ListCustomersQueryDto } from './dto/list-customers-query.dto';

/**
 * jest's asymmetric matchers (`objectContaining`, `anything`, ...) are typed
 * `any` in @types/jest. Routing them through these `unknown`-returning
 * wrappers keeps `no-unsafe-assignment` quiet without disable comments.
 */
function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

function notContaining(obj: Record<string, unknown>): unknown {
  return expect.not.objectContaining(obj);
}

const ANY: unknown = expect.anything();

interface CustomerCreateArgs {
  data: Record<string, unknown>;
}

const baseCustomerRow = {
  id: 'customer-1',
  type: CustomerType.INDIVIDUAL,
  name: 'Orten Trading',
  companyName: null as string | null,
  email: 'contact@orten.example',
  phone: null as string | null,
  alternatePhone: null as string | null,
  addressLine1: null as string | null,
  addressLine2: null as string | null,
  city: null as string | null,
  country: null as string | null,
  postalCode: null as string | null,
  status: CustomerStatus.PROSPECT,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  assignedAgent: null as { id: string; fullName: string; email: string } | null,
  createdBy: null as { id: string; fullName: string; email: string } | null,
  _count: { notes: 3, attachments: 1, interactions: 7 },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'admin@crm.local',
    fullName: 'Admin',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['system-administrator'],
    permissions: ['customers:read', 'customers:write', ARCHIVE_PERMISSION],
    ...overrides,
  };
}

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock<Promise<unknown>, [CustomerCreateArgs]>;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn<Promise<unknown>, [CustomerCreateArgs]>(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }

      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  function query(overrides: Partial<ListCustomersQueryDto> = {}): ListCustomersQueryDto {
    return { page: 1, pageSize: 20, ...overrides };
  }

  describe('list', () => {
    it('builds an empty where and passes skip: 0, take: 20 with no filters', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.list(query());

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        containing({ where: {}, skip: 0, take: 20 }),
      );
    });

    it('builds an OR over name, companyName, email, and phone when search is present, with no mode on phone', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.list(query({ search: '  orten  ' }));

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            OR: [
              { name: { contains: 'orten', mode: 'insensitive' } },
              { companyName: { contains: 'orten', mode: 'insensitive' } },
              { email: { contains: 'orten', mode: 'insensitive' } },
              { phone: { contains: 'orten' } },
            ],
          }),
        }),
      );
    });

    it('adds equality clauses for status and type', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.list(query({ status: CustomerStatus.ACTIVE, type: CustomerType.COMPANY }));

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({ status: CustomerStatus.ACTIVE, type: CustomerType.COMPANY }),
        }),
      );
    });

    it('adds a contains clause for city', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.list(query({ city: 'Cairo' }));

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ city: { contains: 'Cairo', mode: 'insensitive' } }) }),
      );
    });

    it('returns totalPages: 1 for total: 0', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      const result = await service.list(query());

      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('toResponse (via list)', () => {
    it('maps _count into counts and emits ISO strings for createdAt/updatedAt', async () => {
      prisma.customer.findMany.mockResolvedValue([baseCustomerRow]);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.list(query());
      const item = result.items[0];

      expect(item.counts).toEqual({ notes: 3, attachments: 1, interactions: 7 });
      expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(item.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect((item as unknown as { _count?: unknown })._count).toBeUndefined();
    });
  });

  describe('create', () => {
    const dto: CreateCustomerDto = {
      name: '  Orten Trading  ',
      email: 'Contact@Orten.Example',
    };

    it('lower-cases the email, trims the name, and sets createdById from the caller', async () => {
      const caller = buildCaller();
      prisma.customer.create.mockResolvedValue(baseCustomerRow);

      await service.create(dto, caller);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            name: 'Orten Trading',
            email: 'contact@orten.example',
            createdById: caller.id,
          }),
        }),
      );
    });

    it('passes email: null, not undefined, when no email is supplied', async () => {
      const caller = buildCaller();
      prisma.customer.create.mockResolvedValue(baseCustomerRow);

      await service.create({ name: 'No Email Customer' }, caller);

      const createArgs = prisma.customer.create.mock.calls[0][0];
      expect(createArgs.data.email).toBeNull();
    });

    it('rethrows a P2002 PrismaClientKnownRequestError as ConflictException', async () => {
      const caller = buildCaller();
      prisma.customer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.create(dto, caller)).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException for an unknown assignedAgentId and never calls prisma.customer.create', async () => {
      const caller = buildCaller();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...dto, assignedAgentId: 'unknown-agent' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an inactive assignedAgentId', async () => {
      const caller = buildCaller();
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: false });

      await expect(
        service.create({ ...dto, assignedAgentId: 'agent-1' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.PROSPECT,
      });
      prisma.customer.update.mockResolvedValue(baseCustomerRow);
    });

    it('sends null for an explicit { companyName: null }', async () => {
      const caller = buildCaller();

      await service.update(baseCustomerRow.id, { companyName: null }, caller);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        containing({ data: containing({ companyName: null }) }),
      );
    });

    it('sends a payload that does not contain companyName when the field is absent', async () => {
      const caller = buildCaller();

      await service.update(baseCustomerRow.id, { name: 'New Name' }, caller);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        containing({ data: notContaining({ companyName: ANY }) }),
      );
    });

    it('throws BadRequestException before touching prisma.customer.update when the row is ARCHIVED', async () => {
      const caller = buildCaller();
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.ARCHIVED,
      });

      await expect(
        service.update(baseCustomerRow.id, { name: 'New Name' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    it('throws ForbiddenException moving to ARCHIVED without customers:archive', async () => {
      const caller = buildCaller({ permissions: ['customers:write'] });
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.ACTIVE,
      });

      await expect(
        service.setStatus(baseCustomerRow.id, CustomerStatus.ARCHIVED, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('succeeds moving to ARCHIVED with customers:archive', async () => {
      const caller = buildCaller({ permissions: ['customers:write', ARCHIVE_PERMISSION] });
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.ACTIVE,
      });
      prisma.customer.update.mockResolvedValue({
        ...baseCustomerRow,
        status: CustomerStatus.ARCHIVED,
      });

      await expect(
        service.setStatus(baseCustomerRow.id, CustomerStatus.ARCHIVED, caller),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException moving away from ARCHIVED without customers:archive', async () => {
      const caller = buildCaller({ permissions: ['customers:write'] });
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.ARCHIVED,
      });

      await expect(
        service.setStatus(baseCustomerRow.id, CustomerStatus.ACTIVE, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('succeeds moving to the same status the row already has', async () => {
      const caller = buildCaller({ permissions: ['customers:write'] });
      prisma.customer.findUnique.mockResolvedValue({
        id: baseCustomerRow.id,
        status: CustomerStatus.ACTIVE,
      });
      prisma.customer.update.mockResolvedValue(baseCustomerRow);

      await expect(
        service.setStatus(baseCustomerRow.id, CustomerStatus.ACTIVE, caller),
      ).resolves.toBeDefined();
    });
  });
});
