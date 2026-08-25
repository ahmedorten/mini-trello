import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';

interface UserUpdateArgs {
  where: { id: string };
  data: {
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
    lastLoginAt?: Date;
  };
}

const anyDate = expect.any(Date) as unknown as Date;

describe('AuthService', () => {
  let service: AuthService;
  let passwordService: jest.Mocked<Pick<PasswordService, 'verify' | 'hash'>>;
  let tokenService: jest.Mocked<Pick<TokenService, 'issue' | 'consume' | 'revoke'>>;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock<Promise<{ failedLoginAttempts?: number }>, [UserUpdateArgs]>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn<Promise<{ failedLoginAttempts?: number }>, [UserUpdateArgs]>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: { verify: jest.fn(), hash: jest.fn() } },
        {
          provide: TokenService,
          useValue: { issue: jest.fn(), consume: jest.fn(), revoke: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  describe('normalizeEmail', () => {
    it('trims and lower-cases', () => {
      expect(AuthService.normalizeEmail('  Admin@CRM.Local ')).toBe('admin@crm.local');
    });
  });

  describe('login', () => {
    const activeUser = {
      id: 'user-1',
      email: 'admin@crm.local',
      passwordHash: 'stored-hash',
      isActive: true,
      lockedUntil: null as Date | null,
    };

    const SAME_MESSAGE = 'Invalid email or password.';

    it('looks the user up by the normalized email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordService.verify.mockResolvedValue(false);

      await expect(service.login('  Admin@CRM.Local ', 'whatever')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'admin@crm.local' } }),
      );
    });

    it('throws with the same message for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordService.verify.mockResolvedValue(false);

      await expect(service.login('nobody@crm.local', 'whatever')).rejects.toMatchObject({
        message: SAME_MESSAGE,
      });
      expect(passwordService.verify).toHaveBeenCalled();
    });

    it('throws with the same message for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      passwordService.verify.mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({ failedLoginAttempts: 1 });

      await expect(service.login('admin@crm.local', 'wrong')).rejects.toMatchObject({
        message: SAME_MESSAGE,
      });
    });

    it('throws with the same message for an inactive account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });
      passwordService.verify.mockResolvedValue(true);

      await expect(service.login('admin@crm.local', 'whatever')).rejects.toMatchObject({
        message: SAME_MESSAGE,
      });
    });

    it('throws with the same message for a locked account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        lockedUntil: new Date(Date.now() + 60_000),
      });

      await expect(service.login('admin@crm.local', 'whatever')).rejects.toMatchObject({
        message: SAME_MESSAGE,
      });
    });

    it('still calls passwordService.verify on the unknown-email path', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      passwordService.verify.mockResolvedValue(false);

      await expect(service.login('nobody@crm.local', 'whatever')).rejects.toThrow();

      expect(passwordService.verify).toHaveBeenCalledTimes(1);
    });

    it('on success resets attempts, clears lock, sets lastLoginAt, and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      passwordService.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      tokenService.issue.mockResolvedValue({
        accessToken: 'a',
        expiresInSeconds: 900,
        refreshToken: 'r',
        refreshExpiresAt: new Date(),
      });

      const result = await service.login('admin@crm.local', 'correct');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: anyDate },
      });
      expect(tokenService.issue).toHaveBeenCalledWith('user-1', 'admin@crm.local', undefined);
      expect(result.accessToken).toBe('a');
    });

    it('locks the account and resets the counter on the 5th consecutive failure', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      passwordService.verify.mockResolvedValue(false);
      prisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 5 });
      prisma.user.update.mockResolvedValueOnce({});

      await expect(service.login('admin@crm.local', 'wrong')).rejects.toThrow();

      expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'user-1' },
        data: { lockedUntil: anyDate, failedLoginAttempts: 0 },
      });

      const secondCallArgs = prisma.user.update.mock.calls[1][0];
      const lockedUntil = secondCallArgs.data.lockedUntil as Date;
      const minutesAhead = (lockedUntil.getTime() - Date.now()) / 60_000;
      expect(minutesAhead).toBeGreaterThan(14);
      expect(minutesAhead).toBeLessThanOrEqual(15);
    });

    it('succeeds when lockedUntil is in the past', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        lockedUntil: new Date(Date.now() - 60_000),
      });
      passwordService.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      tokenService.issue.mockResolvedValue({
        accessToken: 'a',
        expiresInSeconds: 900,
        refreshToken: 'r',
        refreshExpiresAt: new Date(),
      });

      await expect(service.login('admin@crm.local', 'correct')).resolves.toBeDefined();
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when consume returns null', async () => {
      tokenService.consume.mockResolvedValue(null);

      await expect(service.refresh('raw')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a new pair when consume returns a user id', async () => {
      tokenService.consume.mockResolvedValue('user-1');
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', email: 'admin@crm.local' });
      tokenService.issue.mockResolvedValue({
        accessToken: 'a2',
        expiresInSeconds: 900,
        refreshToken: 'r2',
        refreshExpiresAt: new Date(),
      });

      const result = await service.refresh('raw');

      expect(tokenService.issue).toHaveBeenCalledWith('user-1', 'admin@crm.local', undefined);
      expect(result.accessToken).toBe('a2');
    });
  });

  describe('logout', () => {
    it('resolves and does not call revoke when the token is undefined', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(tokenService.revoke).not.toHaveBeenCalled();
    });

    it('calls revoke when a token is present', async () => {
      await service.logout('raw');
      expect(tokenService.revoke).toHaveBeenCalledWith('raw');
    });
  });

  describe('loadAuthenticatedUser', () => {
    it('flattens roles to permissions, de-duplicates, and sorts both arrays', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@crm.local',
        fullName: 'Admin',
        isActive: true,
        mustChangePassword: false,
        departmentId: null,
        branchId: null,
        roles: [
          {
            role: {
              key: 'role-b',
              permissions: [
                { permission: { key: 'users:read' } },
                { permission: { key: 'users:write' } },
              ],
            },
          },
          {
            role: {
              key: 'role-a',
              permissions: [{ permission: { key: 'users:read' } }],
            },
          },
        ],
      });

      const result = await service.loadAuthenticatedUser('user-1');

      expect(result?.roles).toEqual(['role-a', 'role-b']);
      expect(result?.permissions).toEqual(['users:read', 'users:write']);
    });

    it('returns null for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.loadAuthenticatedUser('missing')).resolves.toBeNull();
    });

    it('returns null for an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        roles: [],
      });

      await expect(service.loadAuthenticatedUser('user-1')).resolves.toBeNull();
    });
  });
});
