import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AgentTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CustomersService, USER_REF_SELECT } from '../customers/customers.service';
import { CUSTOMER_REF_SELECT, TicketsService } from '../tickets/tickets.service';
import { AgentTaskResponseDto, PaginatedAgentTasksDto } from './dto/agent-task.dto';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { UpdateAgentTaskDto } from './dto/update-agent-task.dto';
import { AgentTaskScope, ListAgentTasksQueryDto } from './dto/list-agent-tasks-query.dto';

export const TASK_MANAGE_PERMISSION = 'tasks:manage';

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = [AgentTaskStatus.OPEN, AgentTaskStatus.IN_PROGRESS];

/** The ONLY projection used for agent-task responses. */
const AGENT_TASK_SELECT = {
  id: true,
  title: true,
  notes: true,
  status: true,
  dueAt: true,
  remindAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  assignee: { select: USER_REF_SELECT },
  createdById: true,
  createdBy: { select: USER_REF_SELECT },
  ticketId: true,
  ticket: { select: { id: true, subject: true } },
  customerId: true,
  customer: { select: CUSTOMER_REF_SELECT },
} satisfies Prisma.AgentTaskSelect;

type SelectedAgentTask = Prisma.AgentTaskGetPayload<{ select: typeof AGENT_TASK_SELECT }>;

@Injectable()
export class AgentTasksService {
  private readonly logger = new Logger(AgentTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly customersService: CustomersService,
  ) {}

  async list(
    query: ListAgentTasksQueryDto,
    caller: AuthenticatedUser,
  ): Promise<PaginatedAgentTasksDto> {
    const where: Prisma.AgentTaskWhereInput = {};

    // An explicit assigneeId always wins over `scope` and is gated the same
    // way scope=all is: any target other than the caller needs tasks:manage.
    if (query.assigneeId !== undefined) {
      if (query.assigneeId !== caller.id && !caller.permissions.includes(TASK_MANAGE_PERMISSION)) {
        throw new ForbiddenException(`Missing permission: ${TASK_MANAGE_PERMISSION}`);
      }
      where.assigneeId = query.assigneeId;
    } else if (query.scope === AgentTaskScope.All) {
      // Product rule 9: unlike tickets, scope=all is NOT open to every reader.
      if (!caller.permissions.includes(TASK_MANAGE_PERMISSION)) {
        throw new ForbiddenException(`Missing permission: ${TASK_MANAGE_PERMISSION}`);
      }
    } else {
      where.assigneeId = caller.id;
    }

    if (query.status) where.status = query.status;
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.dueBefore) where.dueAt = { lt: new Date(query.dueBefore) };

    const now = new Date();

    if (query.overdueOnly) {
      where.dueAt = { lt: now };
      where.status = { in: ACTIVE_TASK_STATUSES };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.agentTask.findMany({
        where,
        select: AGENT_TASK_SELECT,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.agentTask.count({ where }),
    ]);

    return {
      items: items.map((item) => AgentTasksService.toResponse(item, now)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string, caller: AuthenticatedUser): Promise<AgentTaskResponseDto> {
    const task = await this.assertVisible(id, caller);

    return AgentTasksService.toResponse(task);
  }

  async create(dto: CreateAgentTaskDto, caller: AuthenticatedUser): Promise<AgentTaskResponseDto> {
    // Product rule 10: defaults to the caller; delegating to someone else is a
    // supervisor action.
    const assigneeId = dto.assigneeId ?? caller.id;

    if (assigneeId !== caller.id && !caller.permissions.includes(TASK_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`Missing permission: ${TASK_MANAGE_PERMISSION}`);
    }

    let customerId = dto.customerId;

    if (dto.ticketId) {
      const ticketCustomerId = await this.ticketCustomerId(dto.ticketId);

      if (dto.customerId && dto.customerId !== ticketCustomerId) {
        throw new BadRequestException('customerId does not match the ticket’s customer.');
      }

      // Derived, not required, so the task is reachable from the customer page
      // too — this is not obvious from the DTO shape alone.
      customerId = customerId ?? ticketCustomerId;
    }

    if (customerId) {
      await this.customersService.assertExists(customerId);
    }

    const created = await this.prisma.agentTask.create({
      data: {
        title: dto.title.trim(),
        notes: dto.notes?.trim(),
        status: dto.status,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : undefined,
        assigneeId,
        createdById: caller.id,
        ticketId: dto.ticketId,
        customerId,
      },
      select: AGENT_TASK_SELECT,
    });

    this.logger.log({ actorId: caller.id, taskId: created.id }, 'Agent task created');

    return AgentTasksService.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateAgentTaskDto,
    caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    const current = await this.assertMutable(id, caller);

    if (dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId) {
      if (dto.assigneeId !== caller.id && !caller.permissions.includes(TASK_MANAGE_PERMISSION)) {
        throw new ForbiddenException(`Missing permission: ${TASK_MANAGE_PERMISSION}`);
      }
    }

    if (dto.ticketId !== undefined || dto.customerId !== undefined) {
      const nextTicketId = dto.ticketId !== undefined ? dto.ticketId : current.ticketId;
      const nextCustomerId = dto.customerId !== undefined ? dto.customerId : current.customerId;

      if (nextTicketId) {
        const ticketCustomerId = await this.ticketCustomerId(nextTicketId);

        if (nextCustomerId && nextCustomerId !== ticketCustomerId) {
          throw new BadRequestException('customerId does not match the ticket’s customer.');
        }
      } else if (nextCustomerId) {
        await this.customersService.assertExists(nextCustomerId);
      }
    }

    const data: Prisma.AgentTaskUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.remindAt !== undefined) data.remindAt = dto.remindAt ? new Date(dto.remindAt) : null;

    if (dto.assigneeId !== undefined) {
      data.assignee = { connect: { id: dto.assigneeId } };
    }

    if (dto.ticketId !== undefined) {
      data.ticket = dto.ticketId ? { connect: { id: dto.ticketId } } : { disconnect: true };
    }

    if (dto.customerId !== undefined) {
      data.customer = dto.customerId ? { connect: { id: dto.customerId } } : { disconnect: true };
    }

    const updated = await this.prisma.agentTask.update({
      where: { id },
      data,
      select: AGENT_TASK_SELECT,
    });

    this.logger.log({ actorId: caller.id, taskId: id }, 'Agent task updated');

    return AgentTasksService.toResponse(updated);
  }

  async setStatus(
    id: string,
    status: AgentTaskStatus,
    caller: AuthenticatedUser,
  ): Promise<AgentTaskResponseDto> {
    await this.assertMutable(id, caller);

    // Product rule 11: DONE stamps completedAt; any other status (including a
    // re-open OR a CANCELLED) clears it back to null.
    const updated = await this.prisma.agentTask.update({
      where: { id },
      data: { status, completedAt: status === AgentTaskStatus.DONE ? new Date() : null },
      select: AGENT_TASK_SELECT,
    });

    this.logger.log({ actorId: caller.id, taskId: id, status }, 'Agent task status changed');

    return AgentTasksService.toResponse(updated);
  }

  async remove(id: string, caller: AuthenticatedUser): Promise<void> {
    await this.assertMutable(id, caller);

    await this.prisma.agentTask.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, taskId: id }, 'Agent task deleted');
  }

  /** 404 if missing; ForbiddenException unless the caller is the assignee,
   *  the creator, or a tasks:manage holder. */
  private async assertVisible(id: string, caller: AuthenticatedUser): Promise<SelectedAgentTask> {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
      select: AGENT_TASK_SELECT,
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (
      task.assigneeId !== caller.id &&
      task.createdById !== caller.id &&
      !caller.permissions.includes(TASK_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenException(
        'Only the assignee, the creator, or a task administrator may access this task.',
      );
    }

    return task;
  }

  /** Deliberately the SAME predicate as assertVisible: a task's creator can
   *  still edit a task they delegated to someone else. */
  private async assertMutable(id: string, caller: AuthenticatedUser): Promise<SelectedAgentTask> {
    return this.assertVisible(id, caller);
  }

  /** Reuses TicketsService.assertExists so an unknown ticketId 404s the same
   *  way every other nested/linked ticket reference does in this codebase,
   *  then reads the one field (customerId) this service actually needs. */
  private async ticketCustomerId(ticketId: string): Promise<string> {
    await this.ticketsService.assertExists(ticketId);

    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { customerId: true },
    });

    return ticket.customerId;
  }

  private static toResponse(task: SelectedAgentTask, now: Date = new Date()): AgentTaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      remindAt: task.remindAt ? task.remindAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      assignee: task.assignee,
      createdBy: task.createdBy,
      ticket: task.ticket,
      customer: task.customer,
      isOverdue:
        task.dueAt !== null &&
        task.dueAt < now &&
        task.status !== AgentTaskStatus.DONE &&
        task.status !== AgentTaskStatus.CANCELLED,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
