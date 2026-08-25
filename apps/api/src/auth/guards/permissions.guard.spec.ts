import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import type { AuthenticatedUser } from '../types/authenticated-user';

interface FakeRequest {
  user?: AuthenticatedUser;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const buildContext = (user?: AuthenticatedUser): ExecutionContext => {
    const request: FakeRequest = { user };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  const buildUser = (permissions: string[]): AuthenticatedUser => ({
    id: 'user-1',
    email: 'a@b.com',
    fullName: 'A',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: [],
    permissions,
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('returns true for a @Public() route with no request.user', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('returns true when the metadata is undefined', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false); // IS_PUBLIC_KEY
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // PERMISSIONS_KEY

    expect(guard.canActivate(buildContext(buildUser([])))).toBe(true);
  });

  it('returns true when the metadata is an empty array', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    reflector.getAllAndOverride.mockReturnValueOnce([]);

    expect(guard.canActivate(buildContext(buildUser([])))).toBe(true);
  });

  it('returns true when the user holds every required permission', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    reflector.getAllAndOverride.mockReturnValueOnce(['users:read', 'users:write']);

    expect(guard.canActivate(buildContext(buildUser(['users:read', 'users:write'])))).toBe(true);
  });

  it('throws ForbiddenException naming only the missing permission when the user holds one of two', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    reflector.getAllAndOverride.mockReturnValueOnce(['users:read', 'users:write']);

    try {
      guard.canActivate(buildContext(buildUser(['users:read'])));
      fail('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe('Missing permission: users:write');
    }
  });

  it('throws ForbiddenException("Permission context unavailable.") when request.user is absent on a non-public route with metadata', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    reflector.getAllAndOverride.mockReturnValueOnce(['users:read']);

    try {
      guard.canActivate(buildContext(undefined));
      fail('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe('Permission context unavailable.');
    }
  });
});
