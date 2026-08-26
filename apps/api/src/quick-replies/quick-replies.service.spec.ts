import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { InteractionChannel, Prisma } from '@prisma/client';
import { QuickRepliesService } from './quick-replies.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseRow = {
  id: 'reply-1',
  key: 'greeting.welcome',
  locale: 'en',
  title: 'Welcome',
  body: 'Hello, thanks for reaching out.',
  channel: null as InteractionChannel | null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: { id: 'admin-1', fullName: 'Admin', email: 'admin@crm.local' },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'agent@crm.local',
    fullName: 'Agent',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['quick-replies:read'],
    ...overrides,
  };
}

describe('QuickRepliesService', () => {
  let service: QuickRepliesService;
  let prisma: {
    quickReply: {
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock<Promise<unknown>, [Record<string, unknown>]>;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      quickReply: {
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [QuickRepliesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<QuickRepliesService>(QuickRepliesService);
  });

  describe('list', () => {
    it('forces isActive: true without quick-replies:write, even when includeInactive is requested', async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);
      const caller = buildCaller({ permissions: ['quick-replies:read'] });

      await service.list({ includeInactive: true }, caller);

      expect(prisma.quickReply.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ isActive: true }) }),
      );
    });

    it('honours includeInactive for a quick-replies:write holder', async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);
      const caller = buildCaller({ permissions: ['quick-replies:read', 'quick-replies:write'] });

      await service.list({ includeInactive: true }, caller);

      const calledWith = prisma.quickReply.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(calledWith.where.isActive).toBeUndefined();
    });

    it('a quick-replies:write holder without includeInactive still gets isActive: true', async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);
      const caller = buildCaller({ permissions: ['quick-replies:read', 'quick-replies:write'] });

      await service.list({}, caller);

      expect(prisma.quickReply.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ isActive: true }) }),
      );
    });

    it('channel filter emits OR: [{ channel }, { channel: null }]', async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);
      const caller = buildCaller();

      await service.list({ channel: InteractionChannel.SMS }, caller);

      expect(prisma.quickReply.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            OR: [{ channel: InteractionChannel.SMS }, { channel: null }],
          }),
        }),
      );
    });

    it('sorts by key asc then locale asc', async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);
      const caller = buildCaller();

      await service.list({}, caller);

      expect(prisma.quickReply.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ key: 'asc' }, { locale: 'asc' }] }),
      );
    });
  });

  describe('create', () => {
    it('maps a P2002 error to ConflictException', async () => {
      const caller = buildCaller({ permissions: ['quick-replies:write'] });
      prisma.quickReply.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.create(
          { key: 'greeting.welcome', locale: 'en', title: 'Welcome', body: 'Hello' },
          caller,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('cannot change key or locale — absent from data even if present on the input object', async () => {
      const caller = buildCaller({ permissions: ['quick-replies:write'] });
      prisma.quickReply.findUnique.mockResolvedValue({ id: 'reply-1' });
      prisma.quickReply.update.mockResolvedValue(baseRow);

      const dto = { title: 'Updated title', key: 'smuggled.key', locale: 'ar' } as unknown as {
        title?: string;
      };

      await service.update('reply-1', dto, caller);

      const updateArgs = prisma.quickReply.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data).not.toHaveProperty('key');
      expect(updateArgs.data).not.toHaveProperty('locale');
      expect(updateArgs.data.title).toBe('Updated title');
    });
  });
});
