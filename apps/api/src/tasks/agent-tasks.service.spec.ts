import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentTaskStatus } from '@prisma/client';
import { AgentTasksService } from './agent-tasks.service';
import { AgentTaskScope } from './dto/list-agent-tasks-query.dto';
import { TicketsService } from '../tickets/tickets.service';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { ListAgentTasksQueryDto } from './dto/list-agent-tasks-query.dto';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseTaskRow = {
  id: 'task-1',
  title: 'Call back',
  notes: null as string | null,
  status: AgentTaskStatus.OPEN,
  dueAt: new Date('2026-06-20T00:00:00.000Z') as Date | null,
  remindAt: null as Date | null,
  completedAt: null as Date | null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  assigneeId: 'caller-1',
  assignee: { id: 'caller-1', fullName: 'Admin', email: 'admin@crm.local' },
  createdById: 'caller-1',
  createdBy: { id: 'caller-1', fullName: 'Admin', email: 'admin@crm.local' },
  ticketId: null as string | null,
  ticket: null as { id: string; subject: string } | null,
  customerId: null as string | null,
  customer: null as { id: string; name: string; email: string | null } | null,
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
    permissions: ['tasks:read', 'tasks:write', 'tasks:manage'],
    ...overrides,
  };
}

describe('AgentTasksService', () => {
  let service: AgentTasksService;
  let prisma: {
    agentTask: {
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock<Promise<unknown>, [Record<string, unknown>]>;
      delete: jest.Mock;
    };
    ticket: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let ticketsService: { assertExists: jest.Mock };
  let customersService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = {
      agentTask: {
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
        delete: jest.fn(),
      },
      ticket: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }

      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    ticketsService = { assertExists: jest.fn().mockResolvedValue({ id: 'ticket-1' }) };
    customersService = { assertExists: jest.fn().mockResolvedValue({ id: 'customer-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentTasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: ticketsService },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    service = module.get<AgentTasksService>(AgentTasksService);
  });

  function query(overrides: Partial<ListAgentTasksQueryDto> = {}): ListAgentTasksQueryDto {
    return { page: 1, pageSize: 20, scope: AgentTaskScope.Mine, ...overrides };
  }

  describe('list', () => {
    beforeEach(() => {
      prisma.agentTask.findMany.mockResolvedValue([]);
      prisma.agentTask.count.mockResolvedValue(0);
    });

    it('scope=mine filters to assigneeId === caller.id', async () => {
      const caller = buildCaller({ id: 'caller-9', permissions: ['tasks:read', 'tasks:write'] });

      await service.list(query({ scope: AgentTaskScope.Mine }), caller);

      expect(prisma.agentTask.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ assigneeId: 'caller-9' }) }),
      );
    });

    it('scope=all without tasks:manage throws ForbiddenException', async () => {
      const caller = buildCaller({ permissions: ['tasks:read', 'tasks:write'] });

      await expect(
        service.list(query({ scope: AgentTaskScope.All }), caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.agentTask.findMany).not.toHaveBeenCalled();
    });

    it('scope=all with tasks:manage does not throw and adds no assigneeId predicate', async () => {
      const caller = buildCaller({ permissions: ['tasks:read', 'tasks:write', 'tasks:manage'] });

      await service.list(query({ scope: AgentTaskScope.All }), caller);

      const calledWith = prisma.agentTask.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(calledWith.where.assigneeId).toBeUndefined();
    });

    it('assigneeId of another user without tasks:manage throws ForbiddenException', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: ['tasks:read', 'tasks:write'] });

      await expect(
        service.list(query({ assigneeId: 'other-user' }), caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.agentTask.findMany).not.toHaveBeenCalled();
    });

    it('assigneeId equal to the caller does not throw', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: ['tasks:read', 'tasks:write'] });

      await expect(service.list(query({ assigneeId: 'caller-1' }), caller)).resolves.toBeDefined();
    });

    it('overdueOnly composes dueAt: { lt: now } with the two active statuses', async () => {
      const caller = buildCaller();

      await service.list(query({ overdueOnly: true }), caller);

      const calledWith = prisma.agentTask.findMany.mock.calls[0][0] as {
        where: { dueAt: { lt: Date }; status: { in: AgentTaskStatus[] } };
      };
      expect(calledWith.where.dueAt.lt).toBeInstanceOf(Date);
      expect(calledWith.where.status.in.sort()).toEqual(
        [AgentTaskStatus.OPEN, AgentTaskStatus.IN_PROGRESS].sort(),
      );
    });

    it('the where never references assignee.isActive', async () => {
      const caller = buildCaller();

      await service.list(query(), caller);

      const calledWith = prisma.agentTask.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(calledWith.where).not.toHaveProperty('assignee');
    });

    it('orders by dueAt asc then createdAt desc', async () => {
      const caller = buildCaller();

      await service.list(query(), caller);

      expect(prisma.agentTask.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }),
      );
    });

    it('pagination meta matches the page/pageSize/total/totalPages shape', async () => {
      prisma.agentTask.count.mockResolvedValue(45);
      const caller = buildCaller();

      const result = await service.list(query({ page: 2, pageSize: 20 }), caller);

      expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    });
  });

  describe('create', () => {
    const dto = { title: 'Call back re: refund' };

    it('defaults assigneeId to the caller', async () => {
      const caller = buildCaller();
      prisma.agentTask.create.mockResolvedValue(baseTaskRow);

      await service.create(dto, caller);

      expect(prisma.agentTask.create).toHaveBeenCalledWith(
        containing({ data: containing({ assigneeId: caller.id, createdById: caller.id }) }),
      );
    });

    it('for another user requires tasks:manage', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: ['tasks:read', 'tasks:write'] });

      await expect(
        service.create({ ...dto, assigneeId: 'other-user' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.agentTask.create).not.toHaveBeenCalled();
    });

    it('for another user succeeds with tasks:manage', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tasks:read', 'tasks:write', 'tasks:manage'],
      });
      prisma.agentTask.create.mockResolvedValue(baseTaskRow);

      await expect(
        service.create({ ...dto, assigneeId: 'other-user' }, caller),
      ).resolves.toBeDefined();
    });

    it('with ticketId only derives customerId from the ticket', async () => {
      const caller = buildCaller();
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ customerId: 'customer-9' });
      prisma.agentTask.create.mockResolvedValue(baseTaskRow);

      await service.create({ ...dto, ticketId: 'ticket-1' }, caller);

      expect(ticketsService.assertExists).toHaveBeenCalledWith('ticket-1');
      expect(customersService.assertExists).toHaveBeenCalledWith('customer-9');
      expect(prisma.agentTask.create).toHaveBeenCalledWith(
        containing({ data: containing({ ticketId: 'ticket-1', customerId: 'customer-9' }) }),
      );
    });

    it('with a mismatched ticketId/customerId pair throws BadRequestException', async () => {
      const caller = buildCaller();
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ customerId: 'customer-9' });

      await expect(
        service.create({ ...dto, ticketId: 'ticket-1', customerId: 'customer-x' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.agentTask.create).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    beforeEach(() => {
      prisma.agentTask.findUnique.mockResolvedValue(baseTaskRow);
    });

    it('DONE stamps completedAt', async () => {
      const caller = buildCaller();
      prisma.agentTask.update.mockResolvedValue({
        ...baseTaskRow,
        status: AgentTaskStatus.DONE,
        completedAt: new Date(),
      });

      await service.setStatus('task-1', AgentTaskStatus.DONE, caller);

      expect(prisma.agentTask.update).toHaveBeenCalledWith(
        containing({
          data: containing({ status: AgentTaskStatus.DONE, completedAt: expect.any(Date) }),
        }),
      );
    });

    it('OPEN on a done task clears completedAt to null', async () => {
      const caller = buildCaller();
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        status: AgentTaskStatus.DONE,
        completedAt: new Date(),
      });
      prisma.agentTask.update.mockResolvedValue(baseTaskRow);

      await service.setStatus('task-1', AgentTaskStatus.OPEN, caller);

      expect(prisma.agentTask.update).toHaveBeenCalledWith(
        containing({ data: containing({ status: AgentTaskStatus.OPEN, completedAt: null }) }),
      );
    });

    it('CANCELLED leaves completedAt null (not stamped)', async () => {
      const caller = buildCaller();
      prisma.agentTask.update.mockResolvedValue({
        ...baseTaskRow,
        status: AgentTaskStatus.CANCELLED,
      });

      await service.setStatus('task-1', AgentTaskStatus.CANCELLED, caller);

      expect(prisma.agentTask.update).toHaveBeenCalledWith(
        containing({ data: containing({ status: AgentTaskStatus.CANCELLED, completedAt: null }) }),
      );
    });
  });

  describe('update — nullable field presence semantics', () => {
    const currentRow = { ...baseTaskRow, ticketId: 'ticket-1', customerId: 'customer-1' };

    beforeEach(() => {
      prisma.agentTask.findUnique.mockResolvedValue(currentRow);
      prisma.agentTask.update.mockResolvedValue(baseTaskRow);
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ customerId: 'customer-1' });
    });

    it('explicit null on notes clears it; an omitted notes key leaves data.notes unset', async () => {
      const caller = buildCaller();

      await service.update('task-1', { notes: null }, caller);
      let updateArgs = prisma.agentTask.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.notes).toBeNull();

      prisma.agentTask.update.mockClear();
      await service.update('task-1', {}, caller);
      updateArgs = prisma.agentTask.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('notes');
    });

    it('explicit null on dueAt clears it; an omitted dueAt key leaves it unset', async () => {
      const caller = buildCaller();

      await service.update('task-1', { dueAt: null }, caller);
      let updateArgs = prisma.agentTask.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.dueAt).toBeNull();

      prisma.agentTask.update.mockClear();
      await service.update('task-1', {}, caller);
      updateArgs = prisma.agentTask.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('dueAt');
    });

    it('explicit null on remindAt clears it; an omitted remindAt key leaves it unset', async () => {
      const caller = buildCaller();

      await service.update('task-1', { remindAt: null }, caller);
      let updateArgs = prisma.agentTask.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.remindAt).toBeNull();

      prisma.agentTask.update.mockClear();
      await service.update('task-1', {}, caller);
      updateArgs = prisma.agentTask.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('remindAt');
    });

    it('explicit null on ticketId disconnects it; an omitted ticketId key leaves data.ticket unset', async () => {
      const caller = buildCaller();

      await service.update('task-1', { ticketId: null }, caller);
      let updateArgs = prisma.agentTask.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.ticket).toEqual({ disconnect: true });

      prisma.agentTask.update.mockClear();
      await service.update('task-1', {}, caller);
      updateArgs = prisma.agentTask.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('ticket');
    });

    it('explicit null on customerId disconnects it; an omitted customerId key leaves data.customer unset', async () => {
      const caller = buildCaller();

      await service.update('task-1', { customerId: null }, caller);
      let updateArgs = prisma.agentTask.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.customer).toEqual({ disconnect: true });

      prisma.agentTask.update.mockClear();
      await service.update('task-1', {}, caller);
      updateArgs = prisma.agentTask.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('customer');
    });

    it('reassigning to someone else without tasks:manage throws ForbiddenException', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: ['tasks:read', 'tasks:write'] });

      await expect(
        service.update('task-1', { assigneeId: 'other-user' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.agentTask.update).not.toHaveBeenCalled();
    });
  });

  describe('assertVisible / findOne', () => {
    it('allows the assignee', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: [] });
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        assigneeId: 'caller-1',
        createdById: 'someone-else',
      });

      await expect(service.findOne('task-1', caller)).resolves.toBeDefined();
    });

    it('allows the creator', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: [] });
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        assigneeId: 'someone-else',
        createdById: 'caller-1',
      });

      await expect(service.findOne('task-1', caller)).resolves.toBeDefined();
    });

    it('allows a tasks:manage holder', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: ['tasks:manage'] });
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        assigneeId: 'someone-else',
        createdById: 'someone-else-too',
      });

      await expect(service.findOne('task-1', caller)).resolves.toBeDefined();
    });

    it('throws ForbiddenException otherwise', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: [] });
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        assigneeId: 'someone-else',
        createdById: 'someone-else-too',
      });

      await expect(service.findOne('task-1', caller)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a missing task', async () => {
      const caller = buildCaller();
      prisma.agentTask.findUnique.mockResolvedValue(null);

      await expect(service.findOne('task-1', caller)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('respects the same visibility predicate as findOne', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: [] });
      prisma.agentTask.findUnique.mockResolvedValue({
        ...baseTaskRow,
        assigneeId: 'someone-else',
        createdById: 'someone-else-too',
      });

      await expect(service.remove('task-1', caller)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.agentTask.delete).not.toHaveBeenCalled();
    });

    it('succeeds for the assignee', async () => {
      const caller = buildCaller({ id: 'caller-1', permissions: [] });
      prisma.agentTask.findUnique.mockResolvedValue({ ...baseTaskRow, assigneeId: 'caller-1' });

      await service.remove('task-1', caller);

      expect(prisma.agentTask.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });
  });
});
