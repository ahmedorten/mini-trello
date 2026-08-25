import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenClaims } from '../token.service';
import type { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = JwtAuthGuard.extractBearer(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let claims: AccessTokenClaims;

    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token);
    } catch {
      // Expired, wrong signature, malformed — all one message. The client
      // reaction (refresh, then redirect to login) is identical.
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const user = await this.authService.loadAuthenticatedUser(claims.sub);

    if (!user) {
      this.logger.warn({ userId: claims.sub }, 'Valid token for a missing or inactive user');
      throw new UnauthorizedException('Account is no longer active.');
    }

    request.user = user;

    return true;
  }

  private static extractBearer(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const [scheme, value] = header.split(' ');

    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
