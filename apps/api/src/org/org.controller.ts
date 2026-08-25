import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  BranchResponseDto,
  CreateBranchDto,
  CreateDepartmentDto,
  DepartmentResponseDto,
  UpdateBranchDto,
  UpdateDepartmentDto,
} from './dto/org-unit.dto';
import { OrgService } from './org.service';

@ApiTags('departments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly orgService: OrgService) {}

  @Get()
  @RequirePermissions('departments:read')
  @ApiOperation({ summary: 'List departments' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  list(): Promise<DepartmentResponseDto[]> {
    return this.orgService.listDepartments();
  }

  @Post()
  @RequirePermissions('departments:write')
  @ApiOperation({ summary: 'Create a department' })
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  @ApiConflictResponse({ description: 'The key is already taken.' })
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    return this.orgService.createDepartment(dto);
  }

  @Patch(':id')
  @RequirePermissions('departments:write')
  @ApiOperation({ summary: 'Update a department', description: 'key is immutable.' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.orgService.updateDepartment(id, dto);
  }
}

@ApiTags('branches')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('branches')
export class BranchesController {
  constructor(private readonly orgService: OrgService) {}

  @Get()
  @RequirePermissions('branches:read')
  @ApiOperation({ summary: 'List branches' })
  @ApiOkResponse({ type: [BranchResponseDto] })
  list(): Promise<BranchResponseDto[]> {
    return this.orgService.listBranches();
  }

  @Post()
  @RequirePermissions('branches:write')
  @ApiOperation({ summary: 'Create a branch' })
  @ApiCreatedResponse({ type: BranchResponseDto })
  @ApiConflictResponse({ description: 'The key is already taken.' })
  create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    return this.orgService.createBranch(dto);
  }

  @Patch(':id')
  @RequirePermissions('branches:write')
  @ApiOperation({ summary: 'Update a branch', description: 'key is immutable.' })
  @ApiOkResponse({ type: BranchResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return this.orgService.updateBranch(id, dto);
  }
}
