import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: jest.Mocked<HealthService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get(HealthService);
  });

  describe('check', () => {
    it('returns 200 status when database is healthy', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
      };

      service.check.mockResolvedValue({
        status: 'ok',
        service: 'customer-support-crm-api',
        version: '0.1.0',
        environment: 'test',
        uptimeSeconds: 5.123,
        timestamp: '2026-08-25T07:10:11.113Z',
        database: {
          status: 'up',
          latencyMs: 3.45,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await controller.check(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('up');
    });

    it('returns 503 status when database is down', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
      };

      service.check.mockResolvedValue({
        status: 'error',
        service: 'customer-support-crm-api',
        version: '0.1.0',
        environment: 'test',
        uptimeSeconds: 5.123,
        timestamp: '2026-08-25T07:10:11.113Z',
        database: {
          status: 'down',
          latencyMs: 50.0,
          message: 'connection refused',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await controller.check(mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(result.status).toBe('error');
      expect(result.database.status).toBe('down');
    });
  });
});
