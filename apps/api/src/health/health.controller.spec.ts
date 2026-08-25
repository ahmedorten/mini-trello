import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service'; // Provider used in testing module

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn().mockReturnValue({
              status: 'ok',
              service: 'customer-support-crm-api',
              version: '0.1.0',
              environment: 'test',
              uptimeSeconds: 5.123,
              timestamp: '2026-08-25T07:10:11.113Z',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns a health response with all six fields', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.environment).toBeDefined();
    expect(result.uptimeSeconds).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
});
