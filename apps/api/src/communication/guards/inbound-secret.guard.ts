import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';

const HEADER = 'x-communication-secret';

/**
 * The entire authentication boundary for the only public write route in this
 * API. @Public() removes the JWT guard, so this guard is what stands between
 * the internet and a row in customer_interactions.
 */
@Injectable()
export class InboundSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.config.get('COMMUNICATION_INBOUND_SECRET', { infer: true });

    if (!configured) {
      // Fail CLOSED (Product rule 4): a deployment that has not opted in has no
      // unauthenticated write path, and says so distinctly from "wrong secret"
      // so an operator debugging a webhook knows which of the two is wrong.
      throw new ServiceUnavailableException('Inbound ingestion is not configured.');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const presented = request.headers[HEADER];

    if (typeof presented !== 'string' || !InboundSecretGuard.matches(presented, configured)) {
      throw new UnauthorizedException('Invalid or missing inbound secret.');
    }

    return true;
  }

  private static matches(presented: string, configured: string): boolean {
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(configured, 'utf8');

    // timingSafeEqual throws on a length mismatch, so compare lengths first —
    // and note that leaks the secret's LENGTH, which is acceptable; leaking a
    // per-character comparison time would not be.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
