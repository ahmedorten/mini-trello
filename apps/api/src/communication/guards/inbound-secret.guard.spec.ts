import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboundSecretGuard } from './inbound-secret.guard';

const SECRET = 'a'.repeat(32);

function contextWith(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function guardWith(configured: string | undefined): InboundSecretGuard {
  const config = { get: jest.fn().mockReturnValue(configured) };

  return new InboundSecretGuard(config as unknown as ConfigService<never, true>);
}

describe('InboundSecretGuard', () => {
  it('fails CLOSED with 503 when COMMUNICATION_INBOUND_SECRET is unset', () => {
    expect(() =>
      guardWith(undefined).canActivate(contextWith({ 'x-communication-secret': SECRET })),
    ).toThrow(ServiceUnavailableException);
  });

  it('401s when the header is missing', () => {
    expect(() => guardWith(SECRET).canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('401s when the header is the wrong length', () => {
    expect(() =>
      guardWith(SECRET).canActivate(contextWith({ 'x-communication-secret': 'short' })),
    ).toThrow(UnauthorizedException);
  });

  it('401s when the header is the same length but wrong', () => {
    expect(() =>
      guardWith(SECRET).canActivate(contextWith({ 'x-communication-secret': 'b'.repeat(32) })),
    ).toThrow(UnauthorizedException);
  });

  it('allows an exact match', () => {
    expect(
      guardWith(SECRET).canActivate(contextWith({ 'x-communication-secret': SECRET })),
    ).toBe(true);
  });
});
