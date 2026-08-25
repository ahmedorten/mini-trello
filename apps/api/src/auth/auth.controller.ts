import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { NodeEnv, EnvironmentVariables } from '../config/env.validation';
import {
  clearedRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './auth.cookie';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CurrentUserDto } from './dto/current-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import type { IssuedTokens } from './token.service';
import type { AuthenticatedUser } from './types/authenticated-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Returns an access token in the body and a rotating refresh token in an httpOnly cookie.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials, or the account is locked.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.login(
      dto.email,
      dto.password,
      request.headers['user-agent'],
    );

    return this.respondWithTokens(tokens, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description: 'Rotates the refresh token. Replaying a consumed token revokes every session.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired, or already-used refresh token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const raw = AuthController.readRefreshCookie(request);

    if (!raw) {
      response.clearCookie(REFRESH_COOKIE_NAME, clearedRefreshCookieOptions(this.isProduction));
      throw new UnauthorizedException('No session cookie.');
    }

    const tokens = await this.authService.refresh(raw, request.headers['user-agent']);

    return this.respondWithTokens(tokens, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out',
    description: 'Revokes the presented refresh token and clears the cookie. Always succeeds.',
  })
  @ApiNoContentResponse({ description: 'Session cleared.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(AuthController.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE_NAME, clearedRefreshCookieOptions(this.isProduction));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user, with roles and permissions' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserDto {
    return user;
  }

  private get isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
  }

  private respondWithTokens(tokens: IssuedTokens, response: Response): LoginResponseDto {
    response.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refreshToken,
      refreshCookieOptions(tokens.refreshExpiresAt, this.isProduction),
    );

    return {
      accessToken: tokens.accessToken,
      expiresInSeconds: tokens.expiresInSeconds,
      tokenType: 'Bearer',
    };
  }

  private static readRefreshCookie(request: Request): string | undefined {
    const value: unknown = request.cookies?.[REFRESH_COOKIE_NAME];

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
