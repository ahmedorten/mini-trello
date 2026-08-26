import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * `assignedAgentId: null` releases the ticket. There is no "absent" case here,
 * unlike UpdateTicketDto: this route exists only to change the assignment, so
 * the key is always meaningful and `undefined` is rejected as a 400.
 */
export class AssignTicketDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedAgentId!: string | null;
}
