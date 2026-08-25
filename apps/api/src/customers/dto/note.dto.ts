import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from './customer-response.dto';

export class CreateNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

/** Same single field, separate class: PATCH and POST diverge the moment either
 *  gains a field, and a shared class makes that a breaking edit in two places. */
export class UpdateNoteDto extends CreateNoteDto {}

export class NoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: () => UserRefDto })
  author!: UserRefDto;

  @ApiProperty()
  body!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
