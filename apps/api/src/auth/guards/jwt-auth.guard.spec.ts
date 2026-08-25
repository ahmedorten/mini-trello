import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../types/authenticated-user';

interface FakeRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let authService: jest.Mocked<Pick<AuthService, 'loadAuthenticatedUser'>>;

  const buildContext = (
    authorization?: string,
  ): { context: ExecutionContext; request: FakeRequest } => {
    const request: FakeRequest = { headers: authorization ? { authorization } : {} };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    jwtService = { verifyAsync: jest.fn() };
    authService = { loadAuthenticatedUser: jest.fn() };

    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
      authService as unknown as AuthService,
    );
  });

  it('returns true immediately, with no token check, when the route is public', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', undefined],
    ['a Basic scheme', 'Basic abc'],
    ['a bare Bearer with no value', 'Bearer'],
  ])('throws Missing bearer token. for %s', async (_label, header) => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = buildContext(header);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      message: 'Missing bearer token.',
    });
  });

  it('accepts a lower-case bearer scheme', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', jti: 'x' });
    authService.loadAuthenticatedUser.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      fullName: 'A',
      mustChangePassword: false,
      departmentId: null,
      branchId: null,
      roles: [],
      permissions: [],
    });
    const { context } = buildContext('bearer sometoken');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws Invalid or expired access token. when verifyAsync rejects', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
    const { context } = buildContext('Bearer sometoken');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      message: 'Invalid or expired access token.',
    });
  });

  it('throws Account is no longer active. when loadAuthenticatedUser returns null', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', jti: 'x' });
    authService.loadAuthenticatedUser.mockResolvedValue(null);
    const { context } = buildContext('Bearer sometoken');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      message: 'Account is no longer active.',
    });
  });

  it('assigns the resolved user to request.user and returns true on success', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', jti: 'x' });
    const resolvedUser = {
      id: 'user-1',
      email: 'a@b.com',
      fullName: 'A',
      mustChangePassword: false,
      departmentId: null,
      branchId: null,
      roles: ['support-agent'],
      permissions: ['departments:read'],
    };
    authService.loadAuthenticatedUser.mockResolvedValue(resolvedUser);
    const { context, request } = buildContext('Bearer sometoken');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(resolvedUser);
  });

  it('rethrows as UnauthorizedException instances', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = buildContext();

    try {
      await guard.canActivate(context);
      fail('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
    }
  });
});
