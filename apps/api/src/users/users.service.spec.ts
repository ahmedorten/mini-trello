import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ADMIN_ROLE_KEY, UsersService } from './users.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateUserDto } from './dto/create-user.dto';
import { UserSortField, type ListUsersQueryDto } from './dto/list-users-query.dto';
import { SortOrder } from '../common/dto/pagination.dto';

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

interface UserCreateArgs {
  data: Record<string, unknown>;
}

const baseUserRow = {
  id: 'user-1',
  email: 'nour@crm.local',
  fullName: 'Nour Hassan',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null as Date | null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  department: null,
  branch: null,
  roles: [{ role: { key: 'support-agent' } }],
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'admin@crm.local',
    fullName: 'Admin',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: [ADMIN_ROLE_KEY],
    permissions: ['users:read', 'users:write', 'users:deactivate', 'roles:assign'],
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash'>>;
  let tokenService: jest.Mocked<Pick<TokenService, 'revokeAllForUser'>>;
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock<Promise<unknown>, [UserCreateArgs]>;
      update: jest.Mock;
    };
    role: { findMany: jest.Mock };
    userRole: { findFirst: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
    department: { findUnique: jest.Mock };
    branch: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn<Promise<unknown>, [UserCreateArgs]>(),
        update: jest.fn(),
      },
      role: { findMany: jest.fn() },
      userRole: { findFirst: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      department: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }

      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: { hash: jest.fn() } },
        { provide: TokenService, useValue: { revokeAllForUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  function query(overrides: Partial<ListUsersQueryDto> = {}): ListUsersQueryDto {
    return { page: 1, pageSize: 20, ...overrides };
  }

  describe('list', () => {
    it('builds an OR over email and fullName with mode: insensitive when search is present', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ search: '  nour  ' }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            OR: [
              { email: { contains: 'nour', mode: 'insensitive' } },
              { fullName: { contains: 'nour', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('omits OR entirely when search is not present', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query());

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ where: notContaining({ OR: ANY }) }),
      );
    });

    it("maps isActive: 'false' to where.isActive === false", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ isActive: 'false' }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ isActive: false }) }),
      );
    });

    it('returns totalPages: 1 for total: 0', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.list(query());

      expect(result.meta.totalPages).toBe(1);
    });

    it('returns totalPages: 7 for total: 137, pageSize: 20', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(137);

      const result = await service.list(query({ pageSize: 20 }));

      expect(result.meta.totalPages).toBe(7);
    });

    it('builds the legacy [fullName asc, email asc] order plus the id tie-breaker with no sort', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query());

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ fullName: 'asc' }, { email: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('orders by the requested column and direction when sort is supplied', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ sort: UserSortField.Email, order: SortOrder.Desc }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ email: 'desc' }, { id: 'asc' }] }),
      );
    });

    it('ignores order when sort is absent', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ order: SortOrder.Desc }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ fullName: 'asc' }, { email: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('pins NULLs last when sorting by the nullable lastLoginAt column', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ sort: UserSortField.LastLoginAt, order: SortOrder.Desc }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }] }),
      );
    });

    it('passes skip: 40 for page: 3, pageSize: 20', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.list(query({ page: 3, pageSize: 20 }));

      expect(prisma.user.findMany).toHaveBeenCalledWith(containing({ skip: 40, take: 20 }));
    });
  });

  describe('toResponse (via list)', () => {
    it('output has no passwordHash, failedLoginAttempts, or lockedUntil key', async () => {
      prisma.user.findMany.mockResolvedValue([baseUserRow]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list(query());
      const keys = Object.keys(result.items[0]);

      expect(keys).not.toContain('passwordHash');
      expect(keys).not.toContain('failedLoginAttempts');
      expect(keys).not.toContain('lockedUntil');
    });
  });

  describe('findOne', () => {
    it('resolves for id === caller.id when caller.permissions is empty', async () => {
      const caller = buildCaller({ id: baseUserRow.id, permissions: [] });
      prisma.user.findUnique.mockResolvedValue(baseUserRow);

      await expect(service.findOne(baseUserRow.id, caller)).resolves.toBeDefined();
    });

    it('throws ForbiddenException for a different id with the same caller', async () => {
      const caller = buildCaller({ id: 'someone-else', permissions: [] });

      await expect(service.findOne(baseUserRow.id, caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'Nour.Hassan@CRM.local',
      fullName: 'Nour Hassan',
      password: 'plaintext-password-1',
      roleKeys: ['support-agent'],
    };

    it('hashes the password, lower-cases the email, sets mustChangePassword: true, and never passes the plaintext to Prisma', async () => {
      const caller = buildCaller();
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', key: 'support-agent' }]);
      passwordService.hash.mockResolvedValue('hashed-value');
      prisma.user.create.mockResolvedValue(baseUserRow);

      await service.create(dto, caller);

      expect(passwordService.hash).toHaveBeenCalledWith('plaintext-password-1');
      expect(prisma.user.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            email: 'nour.hassan@crm.local',
            passwordHash: 'hashed-value',
            mustChangePassword: true,
          }),
        }),
      );

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.password).toBeUndefined();
    });

    it('maps a P2002 PrismaClientKnownRequestError to ConflictException', async () => {
      const caller = buildCaller();
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', key: 'support-agent' }]);
      passwordService.hash.mockResolvedValue('hashed-value');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.create(dto, caller)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: baseUserRow.id });
      prisma.user.update.mockResolvedValue(baseUserRow);
    });

    it('emits { disconnect: true } for departmentId: null', async () => {
      const caller = buildCaller();

      await service.update(baseUserRow.id, { departmentId: null }, caller);

      expect(prisma.user.update).toHaveBeenCalledWith(
        containing({ data: containing({ department: { disconnect: true } }) }),
      );
    });

    it('emits { connect: … } for a real departmentId', async () => {
      const caller = buildCaller();
      const departmentId = '11111111-1111-1111-1111-111111111111';
      prisma.department.findUnique.mockResolvedValue({ id: departmentId });

      await service.update(baseUserRow.id, { departmentId }, caller);

      expect(prisma.user.update).toHaveBeenCalledWith(
        containing({ data: containing({ department: { connect: { id: departmentId } } }) }),
      );
    });

    it('touches neither key when the field is absent', async () => {
      const caller = buildCaller();

      await service.update(baseUserRow.id, { fullName: 'New Name' }, caller);

      expect(prisma.user.update).toHaveBeenCalledWith(
        containing({ data: notContaining({ department: ANY }) }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        containing({ data: notContaining({ branch: ANY }) }),
      );
    });
  });

  describe('setStatus', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 'other-user' });
      prisma.user.update.mockResolvedValue(baseUserRow);
      prisma.user.count.mockResolvedValue(1);
      prisma.userRole.findFirst.mockResolvedValue(null);
    });

    it('setStatus(caller.id, false, caller) throws BadRequestException', async () => {
      const caller = buildCaller();

      await expect(service.setStatus(caller.id, false, caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('setStatus(other, false, caller) calls tokenService.revokeAllForUser(other)', async () => {
      const caller = buildCaller();

      await service.setStatus('other-user', false, caller);

      expect(tokenService.revokeAllForUser).toHaveBeenCalledWith('other-user');
    });

    it('setStatus(other, true, caller) does not call revokeAllForUser', async () => {
      const caller = buildCaller();

      await service.setStatus('other-user', true, caller);

      expect(tokenService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('resolveRoles (via create/setRoles)', () => {
    it('deduplicates role keys', async () => {
      const caller = buildCaller();
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', key: 'support-agent' }]);
      passwordService.hash.mockResolvedValue('hashed-value');
      prisma.user.create.mockResolvedValue(baseUserRow);

      await service.create(
        {
          email: 'x@crm.local',
          fullName: 'X',
          password: 'plaintext-password-1',
          roleKeys: ['support-agent', 'support-agent'],
        },
        caller,
      );

      expect(prisma.role.findMany).toHaveBeenCalledWith(
        containing({ where: { key: { in: ['support-agent'] } } }),
      );
    });

    it('throws ForbiddenException when a non-administrator caller requests system-administrator', async () => {
      const caller = buildCaller({ roles: ['crm-manager'] });

      await expect(
        service.create(
          {
            email: 'x@crm.local',
            fullName: 'X',
            password: 'plaintext-password-1',
            roleKeys: [ADMIN_ROLE_KEY],
          },
          caller,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException naming every unknown key', async () => {
      const caller = buildCaller();
      prisma.role.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          {
            email: 'x@crm.local',
            fullName: 'X',
            password: 'plaintext-password-1',
            roleKeys: ['nope-one', 'nope-two'],
          },
          caller,
        ),
      ).rejects.toMatchObject({ message: 'Unknown role key: nope-one, nope-two' });
    });
  });

  describe('resetPassword', () => {
    it('revokes all tokens and sets mustChangePassword: true', async () => {
      const caller = buildCaller();
      prisma.user.findUnique.mockResolvedValue({ id: baseUserRow.id });
      prisma.user.update.mockResolvedValue({});
      passwordService.hash.mockResolvedValue('new-hash');

      await service.resetPassword(baseUserRow.id, { password: 'new-plaintext-1' }, caller);

      expect(prisma.user.update).toHaveBeenCalledWith(
        containing({ data: containing({ mustChangePassword: true, passwordHash: 'new-hash' }) }),
      );
      expect(tokenService.revokeAllForUser).toHaveBeenCalledWith(baseUserRow.id);
    });
  });

  describe('last-administrator protection', () => {
    const targetId = 'target-admin';

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: targetId });
      prisma.userRole.findFirst.mockResolvedValue({ userId: targetId });
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', key: 'support-agent' }]);
    });

    it('setStatus and setRoles both throw when 0 other active administrators remain', async () => {
      const caller = buildCaller();
      prisma.user.count.mockResolvedValue(0);

      await expect(service.setStatus(targetId, false, caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.setRoles(targetId, { roleKeys: ['support-agent'] }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('setStatus and setRoles both succeed when 1 other active administrator remains', async () => {
      const caller = buildCaller();
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue(baseUserRow);
      prisma.user.findUniqueOrThrow.mockResolvedValue(baseUserRow);

      await expect(service.setStatus(targetId, false, caller)).resolves.toBeDefined();
      await expect(
        service.setRoles(targetId, { roleKeys: ['support-agent'] }, caller),
      ).resolves.toBeDefined();
    });
  });
});
