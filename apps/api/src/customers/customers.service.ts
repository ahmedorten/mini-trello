import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto, PaginatedCustomersDto } from './dto/customer-response.dto';

export const ARCHIVE_PERMISSION = 'customers:archive';

const USER_REF_SELECT = { id: true, fullName: true, email: true } satisfies Prisma.UserSelect;

/** The ONLY projection used for customer responses. Explicit, so a column added
 *  to the model later cannot leak into an API response by accident. */
const CUSTOMER_SELECT = {
  id: true,
  type: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  alternatePhone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  country: true,
  postalCode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  assignedAgent: { select: USER_REF_SELECT },
  createdBy: { select: USER_REF_SELECT },
  _count: { select: { notes: true, attachments: true, interactions: true } },
} satisfies Prisma.CustomerSelect;

type SelectedCustomer = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCustomersQueryDto): Promise<PaginatedCustomersDto> {
    const where: Prisma.CustomerWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.assignedAgentId) {
      where.assignedAgentId = query.assignedAgentId;
    }

    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: rows.map((row) => CustomersService.toResponse(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: CUSTOMER_SELECT,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return CustomersService.toResponse(customer);
  }

  async create(dto: CreateCustomerDto, caller: AuthenticatedUser): Promise<CustomerResponseDto> {
    await this.assertAgentExists(dto.assignedAgentId);

    const email = dto.email ? AuthService.normalizeEmail(dto.email) : null;

    try {
      const created = await this.prisma.customer.create({
        data: {
          type: dto.type,
          name: dto.name.trim(),
          companyName: dto.companyName?.trim(),
          email,
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          addressLine1: dto.addressLine1?.trim(),
          addressLine2: dto.addressLine2?.trim(),
          city: dto.city?.trim(),
          country: dto.country?.trim(),
          postalCode: dto.postalCode?.trim(),
          status: dto.status,
          assignedAgentId: dto.assignedAgentId,
          createdById: caller.id,
        },
        select: CUSTOMER_SELECT,
      });

      this.logger.log({ actorId: caller.id, customerId: created.id }, 'Customer created');

      return CustomersService.toResponse(created);
    } catch (error) {
      throw CustomersService.mapPrismaError(error, email ?? undefined);
    }
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    caller: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    const current = await this.assertExists(id);

    if (current.status === CustomerStatus.ARCHIVED) {
      throw new BadRequestException('An archived customer cannot be edited. Restore it first.');
    }

    await this.assertAgentExists(dto.assignedAgentId ?? undefined);

    const data: Prisma.CustomerUpdateInput = {};

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    // `in` rather than a truthiness check: an explicit null must clear the
    // field, while an absent key must leave it untouched.
    if ('companyName' in dto) {
      data.companyName = dto.companyName?.trim() ?? null;
    }

    if ('email' in dto) {
      data.email = dto.email ? AuthService.normalizeEmail(dto.email) : null;
    }

    if ('phone' in dto) {
      data.phone = dto.phone?.trim() ?? null;
    }

    if ('alternatePhone' in dto) {
      data.alternatePhone = dto.alternatePhone?.trim() ?? null;
    }

    if ('addressLine1' in dto) {
      data.addressLine1 = dto.addressLine1?.trim() ?? null;
    }

    if ('addressLine2' in dto) {
      data.addressLine2 = dto.addressLine2?.trim() ?? null;
    }

    if ('city' in dto) {
      data.city = dto.city?.trim() ?? null;
    }

    if ('country' in dto) {
      data.country = dto.country?.trim() ?? null;
    }

    if ('postalCode' in dto) {
      data.postalCode = dto.postalCode?.trim() ?? null;
    }

    if ('assignedAgentId' in dto) {
      data.assignedAgent = dto.assignedAgentId
        ? { connect: { id: dto.assignedAgentId } }
        : { disconnect: true };
    }

    try {
      const updated = await this.prisma.customer.update({
        where: { id },
        data,
        select: CUSTOMER_SELECT,
      });

      this.logger.log({ actorId: caller.id, customerId: id }, 'Customer updated');

      return CustomersService.toResponse(updated);
    } catch (error) {
      throw CustomersService.mapPrismaError(error, data.email as string | undefined);
    }
  }

  async setStatus(
    id: string,
    status: CustomerStatus,
    caller: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    const current = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new NotFoundException('Customer not found.');
    }

    // The guard cannot see the request body, so the archive rule lives here.
    // Both directions are gated: a caller who may not archive may not restore
    // either, or the weaker permission silently undoes the stronger one.
    const touchesArchive =
      status === CustomerStatus.ARCHIVED || current.status === CustomerStatus.ARCHIVED;

    if (touchesArchive && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
      throw new ForbiddenException(`Missing permission: ${ARCHIVE_PERMISSION}`);
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { status },
      select: CUSTOMER_SELECT,
    });

    this.logger.log(
      { actorId: caller.id, customerId: id, from: current.status, to: status },
      'Customer status changed',
    );

    return CustomersService.toResponse(updated);
  }

  private async assertExists(id: string): Promise<{ id: string; status: CustomerStatus }> {
    const exists = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!exists) {
      throw new NotFoundException('Customer not found.');
    }

    return exists;
  }

  private async assertAgentExists(assignedAgentId?: string): Promise<void> {
    if (!assignedAgentId) {
      return;
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: assignedAgentId },
      select: { id: true, isActive: true },
    });

    if (!agent) {
      throw new BadRequestException('Unknown assignedAgentId.');
    }

    if (!agent.isActive) {
      throw new BadRequestException('Cannot assign an inactive user.');
    }
  }

  private static mapPrismaError(error: unknown, email?: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(
        `A customer with the email ${email ?? ''} already exists.`.trim(),
      );
    }

    return error instanceof Error ? error : new Error('Unknown persistence error');
  }

  private static toResponse(customer: SelectedCustomer): CustomerResponseDto {
    return {
      id: customer.id,
      type: customer.type,
      name: customer.name,
      companyName: customer.companyName,
      email: customer.email,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      city: customer.city,
      country: customer.country,
      postalCode: customer.postalCode,
      status: customer.status,
      assignedAgent: customer.assignedAgent,
      createdBy: customer.createdBy,
      counts: {
        notes: customer._count.notes,
        attachments: customer._count.attachments,
        interactions: customer._count.interactions,
      },
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}
