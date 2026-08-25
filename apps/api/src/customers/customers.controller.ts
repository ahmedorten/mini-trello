import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { SetCustomerStatusDto } from './dto/set-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto, PaginatedCustomersDto } from './dto/customer-response.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'List customers',
    description: 'Paginated, searchable across name/company/email/phone, filterable.',
  })
  @ApiOkResponse({ type: PaginatedCustomersDto })
  list(@Query() query: ListCustomersQueryDto): Promise<PaginatedCustomersDto> {
    return this.customersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'Get one customer' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'No such customer.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    return this.customersService.findOne(id);
  }

  @Post()
  @RequirePermissions('customers:write')
  @ApiOperation({ summary: 'Create a customer' })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or an unknown/inactive assignedAgentId.',
  })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    return this.customersService.create(dto, caller);
  }

  @Patch(':id')
  @RequirePermissions('customers:write')
  @ApiOperation({ summary: 'Update a customer profile' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({ description: 'The email address is already taken.' })
  @ApiBadRequestResponse({
    description:
      'Validation failed, an unknown/inactive assignedAgentId, or the customer is archived.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermissions('customers:write')
  @ApiOperation({
    summary: 'Move a customer through its lifecycle',
    description:
      'Entering or leaving ARCHIVED additionally requires the customers:archive permission, ' +
      'in both directions — otherwise customers:write alone could silently restore an archived record.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiForbiddenResponse({ description: 'Archiving or restoring needs customers:archive.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerStatusDto,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    return this.customersService.setStatus(id, dto.status, caller);
  }
}
