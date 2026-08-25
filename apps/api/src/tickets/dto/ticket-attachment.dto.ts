import { ApiProperty } from '@nestjs/swagger';
import { UserRefDto } from '../../customers/dto/customer-response.dto';

/** `storageKey` is deliberately absent here. It is an internal path; publishing
 *  it invites a client to construct one. */
export class TicketAttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({
    example: 'screenshot.png',
    description: "The client's original filename. Display only.",
  })
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 148_320 })
  sizeBytes!: number;

  @ApiProperty({
    example: 'e3b0c442…',
    description: 'SHA-256 of the stored bytes. Recorded, not enforced.',
  })
  checksumSha256!: string;

  @ApiProperty({ type: () => UserRefDto })
  uploadedBy!: UserRefDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
