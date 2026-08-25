import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RoleResponseDto } from './dto/role-response.dto';

@ApiTags('roles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles:read')
  @ApiOperation({
    summary: 'List roles',
    description: 'Every role with its sorted permission keys and active holder count.',
  })
  @ApiOkResponse({ type: [RoleResponseDto] })
  async list(): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: { where: { user: { isActive: true } } } } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((grant) => grant.permission.key).sort(),
      userCount: role._count.users,
    }));
  }
}
