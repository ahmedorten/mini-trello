import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'Bearer token. Hold in memory only — never in localStorage.' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds.' })
  expiresInSeconds!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}
