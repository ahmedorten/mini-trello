import { ApiProperty } from '@nestjs/swagger';
import { UserRefDto } from './customer-response.dto';

/** `storageKey` is deliberately absent here. It is an internal path; publishing
 *  it invites a client to construct one. */
export class AttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({
    example: 'signed-contract.pdf',
    description: "The client's original filename. Display only.",
  })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
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
