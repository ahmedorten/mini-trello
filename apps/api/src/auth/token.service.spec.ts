import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentVariables } from '../config/env.validation';

interface RefreshTokenCreateArgs {
  data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string };
}

const anyDate = expect.any(Date) as unknown as Date;

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let configService: jest.Mocked<Pick<ConfigService<EnvironmentVariables, true>, 'get'>>;
  let prisma: {
    refreshToken: {
      create: jest.Mock<Promise<unknown>, [RefreshTokenCreateArgs]>;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        create: jest.fn<Promise<unknown>, [RefreshTokenCreateArgs]>(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('digest', () => {
    it('is deterministic and 64 hex characters', () => {
      const digest = TokenService.digest('some-raw-token');

      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(TokenService.digest('some-raw-token')).toBe(digest);
    });

    it('differs for differing input', () => {
      expect(TokenService.digest('token-a')).not.toBe(TokenService.digest('token-b'));
    });
  });

  describe('ttlToSeconds', () => {
    it.each([
      ['900s', 900],
      ['15m', 900],
      ['1h', 3600],
      ['1d', 86400],
      ['not-a-ttl', 900],
    ])('maps %s to %d seconds', (input, expected) => {
      expect(TokenService.ttlToSeconds(input)).toBe(expected);
    });
  });

  describe('issue', () => {
    it('signs an access token with expiresIn from config and writes a hashed refresh token', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL_DAYS') return 7;
        return undefined;
      });
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.issue('user-1', 'user@example.com', 'some-agent');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'user@example.com' }),
        { expiresIn: '15m' },
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.expiresInSeconds).toBe(900);

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.tokenHash).toBe(TokenService.digest(result.refreshToken));
      expect(createArgs.data.tokenHash).not.toBe(result.refreshToken);
    });

    it('truncates a 10000-character user agent to 255 characters', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL_DAYS') return 7;
        return undefined;
      });
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');
      prisma.refreshToken.create.mockResolvedValue({});

      await service.issue('user-1', 'user@example.com', 'a'.repeat(10000));

      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.userAgent).toHaveLength(255);
    });
  });

  describe('consume', () => {
    it('returns the user id and marks the row revoked for a valid token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'user-1', isActive: true },
      });
      prisma.refreshToken.update.mockResolvedValue({});

      const userId = await service.consume('raw-token');

      expect(userId).toBe('user-1');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: { revokedAt: anyDate },
      });
    });

    it('revokes all sessions for the user and returns null when the token is already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'user-1', isActive: true },
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const userId = await service.consume('raw-token');

      expect(userId).toBeNull();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: anyDate },
      });
    });

    it('returns null for an unknown digest', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.consume('raw-token')).resolves.toBeNull();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('returns null for an expired row', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-1', isActive: true },
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await expect(service.consume('raw-token')).resolves.toBeNull();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: { revokedAt: anyDate },
      });
    });

    it('returns null for a row whose user is inactive', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'user-1', isActive: false },
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await expect(service.consume('raw-token')).resolves.toBeNull();
    });
  });

  describe('revoke', () => {
    it('filters on revokedAt: null', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: TokenService.digest('raw-token'), revokedAt: null },
        data: { revokedAt: anyDate },
      });
    });

    it('resolves without throwing for an unknown token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke('unknown-token')).resolves.toBeUndefined();
    });
  });
});
