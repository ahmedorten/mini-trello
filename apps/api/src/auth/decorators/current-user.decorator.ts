import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the user JwtAuthGuard resolved. Only valid on routes the guard ran
 * on — on a @Public() route it is undefined, hence the non-null assertion is
 * deliberately absent from the return type.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (!request.user) {
      throw new Error('@CurrentUser() used on a route without JwtAuthGuard');
    }

    return request.user;
  },
);
