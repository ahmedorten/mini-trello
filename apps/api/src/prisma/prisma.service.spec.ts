import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    jest.spyOn(service, '$connect').mockResolvedValue(undefined);

    jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('calls $connect when initializing', async () => {
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.$connect).toHaveBeenCalledTimes(1);
    });

    it('throws when $connect fails', async () => {
      const error = new Error('Connection failed');
      jest.spyOn(service, '$connect').mockRejectedValueOnce(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('onModuleDestroy', () => {
    it('calls $disconnect when destroying', async () => {
      await service.onModuleDestroy();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.$disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
