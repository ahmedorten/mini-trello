import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List users', description: 'Paginated, searchable, filterable.' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one user',
    description: 'Any authenticated caller may read their own record; others need users:read.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No such user.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, caller);
  }

  @Post()
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or an unknown role/department/branch.',
  })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Update a user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermissions('users:deactivate')
  @ApiOperation({
    summary: 'Activate or deactivate a user',
    description: 'Deactivating revokes every refresh token for that user.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Self-deactivation, or the last active administrator.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.setStatus(id, dto.isActive, caller);
  }

  @Put(':id/roles')
  @RequirePermissions('roles:assign')
  @ApiOperation({
    summary: 'Replace a user role set',
    description: 'PUT, not PATCH: the supplied list becomes the complete role set.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Unknown role key, or the last active administrator.' })
  setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.setRoles(id, dto, caller);
  }

  @Post(':id/password')
  @RequirePermissions('users:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset a user password as an administrator',
    description: 'Sets mustChangePassword and revokes every session for that user.',
  })
  @ApiNoContentResponse({ description: 'Password replaced.' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.usersService.resetPassword(id, dto, caller);
  }
}
