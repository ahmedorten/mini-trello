import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';

export const ADMIN_ROLE_KEY = 'system-administrator';

/**
 * The ONLY projection used for user responses. passwordHash, lockedUntil, and
 * failedLoginAttempts are absent by construction — a `select` cannot leak a
 * column it does not name, which a `spread` of the row would.
 */
const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  department: { select: { id: true, key: true, name: true } },
  branch: { select: { id: true, key: true, name: true } },
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.roleKey) {
      where.roles = { some: { role: { key: query.roleKey } } };
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => UsersService.toResponse(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string, caller: AuthenticatedUser): Promise<UserResponseDto> {
    // Anyone may read their own record; reading anybody else needs users:read.
    if (id !== caller.id && !caller.permissions.includes('users:read')) {
      throw new ForbiddenException('Missing permission: users:read');
    }

    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return UsersService.toResponse(user);
  }

  async create(dto: CreateUserDto, caller: AuthenticatedUser): Promise<UserResponseDto> {
    const roleIds = await this.resolveRoles(dto.roleKeys, caller);
    const email = AuthService.normalizeEmail(dto.email);

    await this.assertOrgUnitsExist(dto.departmentId, dto.branchId);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          passwordHash: await this.passwordService.hash(dto.password),
          mustChangePassword: true,
          departmentId: dto.departmentId ?? null,
          branchId: dto.branchId ?? null,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        select: USER_SELECT,
      });

      this.logger.log({ actorId: caller.id, userId: created.id }, 'User created');

      return UsersService.toResponse(created);
    } catch (error) {
      throw UsersService.mapPrismaError(error, email);
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    await this.assertExists(id);
    await this.assertOrgUnitsExist(dto.departmentId ?? undefined, dto.branchId ?? undefined);

    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) {
      data.email = AuthService.normalizeEmail(dto.email);
    }

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
    }

    // `in` rather than a truthiness check: an explicit null must clear the
    // assignment, while an absent key must leave it untouched.
    if ('departmentId' in dto) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    if ('branchId' in dto) {
      data.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    }

    try {
      const updated = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });

      this.logger.log({ actorId: caller.id, userId: id }, 'User updated');

      return UsersService.toResponse(updated);
    } catch (error) {
      throw UsersService.mapPrismaError(error, data.email as string | undefined);
    }
  }

  async setStatus(
    id: string,
    isActive: boolean,
    caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (!isActive) {
      if (id === caller.id) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }

      await this.assertNotLastAdministrator(id, 'deactivated');
    }

    await this.assertExists(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: isActive
        ? { isActive: true, failedLoginAttempts: 0, lockedUntil: null }
        : { isActive: false },
      select: USER_SELECT,
    });

    if (!isActive) {
      // Deactivation must end live sessions, not just block new logins. The
      // access token is already dead on the next request because
      // loadAuthenticatedUser returns null for an inactive user; this closes
      // the refresh path too.
      await this.tokenService.revokeAllForUser(id);
    }

    this.logger.log({ actorId: caller.id, userId: id, isActive }, 'User status changed');

    return UsersService.toResponse(updated);
  }

  async setRoles(
    id: string,
    dto: SetUserRolesDto,
    caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    await this.assertExists(id);

    const roleIds = await this.resolveRoles(dto.roleKeys, caller);
    const keeping = dto.roleKeys.includes(ADMIN_ROLE_KEY);

    if (!keeping) {
      await this.assertRemovingAdminIsSafe(id, caller);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });

      return tx.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT });
    });

    this.logger.log({ actorId: caller.id, userId: id, roles: dto.roleKeys }, 'User roles replaced');

    return UsersService.toResponse(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, caller: AuthenticatedUser): Promise<void> {
    await this.assertExists(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await this.passwordService.hash(dto.password),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // A password reset invalidates every existing session, including the
    // caller's own if they reset themselves.
    await this.tokenService.revokeAllForUser(id);

    this.logger.log({ actorId: caller.id, userId: id }, 'Password reset by administrator');
  }

  private async resolveRoles(roleKeys: string[], caller: AuthenticatedUser): Promise<string[]> {
    const unique = [...new Set(roleKeys)];

    // The one place a role key appears in application logic: only an
    // administrator may mint another administrator.
    if (unique.includes(ADMIN_ROLE_KEY) && !caller.roles.includes(ADMIN_ROLE_KEY)) {
      throw new ForbiddenException(`Only a ${ADMIN_ROLE_KEY} can grant ${ADMIN_ROLE_KEY}.`);
    }

    const roles = await this.prisma.role.findMany({
      where: { key: { in: unique } },
      select: { id: true, key: true },
    });

    if (roles.length !== unique.length) {
      const found = new Set(roles.map((role) => role.key));
      const unknown = unique.filter((key) => !found.has(key));
      throw new BadRequestException(`Unknown role key: ${unknown.join(', ')}`);
    }

    return roles.map((role) => role.id);
  }

  private async assertRemovingAdminIsSafe(id: string, caller: AuthenticatedUser): Promise<void> {
    const target = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { key: ADMIN_ROLE_KEY } },
      select: { userId: true },
    });

    if (!target) {
      return;
    }

    if (!caller.roles.includes(ADMIN_ROLE_KEY)) {
      throw new ForbiddenException(`Only a ${ADMIN_ROLE_KEY} can revoke ${ADMIN_ROLE_KEY}.`);
    }

    await this.assertNotLastAdministrator(id, 'demoted');
  }

  private async assertNotLastAdministrator(id: string, verb: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        id: { not: id },
        isActive: true,
        roles: { some: { role: { key: ADMIN_ROLE_KEY } } },
      },
    });

    const isAdmin = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { key: ADMIN_ROLE_KEY } },
      select: { userId: true },
    });

    if (isAdmin && remaining === 0) {
      throw new BadRequestException(
        `The last active ${ADMIN_ROLE_KEY} cannot be ${verb}. Grant the role to another active user first.`,
      );
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('User not found.');
    }
  }

  private async assertOrgUnitsExist(departmentId?: string, branchId?: string): Promise<void> {
    if (departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) {
        throw new BadRequestException('Unknown departmentId.');
      }
    }

    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true },
      });

      if (!branch) {
        throw new BadRequestException('Unknown branchId.');
      }
    }
  }

  private static mapPrismaError(error: unknown, email?: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A user with the email ${email ?? ''} already exists.`.trim());
    }

    return error instanceof Error ? error : new Error('Unknown persistence error');
  }

  private static toResponse(user: SelectedUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      department: user.department,
      branch: user.branch,
      roles: user.roles.map((assignment) => assignment.role.key).sort(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
