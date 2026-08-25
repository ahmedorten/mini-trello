import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentVariables } from '../config/env.validation';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService<EnvironmentVariables, true>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);

    config.get.mockReturnValue('development');
  });

  describe('check', () => {
    it('returns ok status when database is up', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (prisma as any).$queryRaw.mockResolvedValue(null);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('up');
      expect(typeof result.database.latencyMs).toBe('number');
      expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.database.message).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((prisma as any).$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns error status when database probe is rejected', async () => {
      const error = new Error('connection refused');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (prisma as any).$queryRaw.mockRejectedValue(error);

      const result = await service.check();

      expect(result.status).toBe('error');
      expect(result.database.status).toBe('down');
      expect(result.database.message).toBe('connection refused');
      expect(typeof result.database.latencyMs).toBe('number');
      expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('handles non-Error rejection with Unknown database error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (prisma as any).$queryRaw.mockRejectedValue('unknown error');

      const result = await service.check();

      expect(result.status).toBe('error');
      expect(result.database.status).toBe('down');
      expect(result.database.message).toBe('Unknown database error');
    });

    it('includes service info in response', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (prisma as any).$queryRaw.mockResolvedValue(null);

      const result = await service.check();

      expect(result.service).toBe('customer-support-crm-api');
      expect(result.version).toBeDefined();
      expect(result.environment).toBe('development');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });
  });
});
