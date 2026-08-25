import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { MAX_ATTACHMENTS_PER_TICKET, TicketAttachmentsService } from './ticket-attachments.service';
import { TicketsService } from './tickets.service';
import { AttachmentStorageService } from '../common/attachment-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { EnvironmentVariables } from '../config/env.validation';

const baseAttachmentRow = {
  id: 'attachment-1',
  ticketId: 'ticket-1',
  fileName: 'screenshot.png',
  mimeType: 'image/png',
  sizeBytes: 128,
  checksumSha256: 'a'.repeat(64),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  uploadedById: 'uploader-1',
  uploadedBy: { id: 'uploader-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'uploader-1',
    email: 'nour@crm.local',
    fullName: 'Nour Hassan',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['tickets:read', 'ticket-attachments:write'],
    ...overrides,
  };
}

interface TicketAttachmentCreateArgs {
  data: { fileName: string };
}

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'screenshot.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 128,
    buffer: Buffer.from('fake png bytes'),
    stream: undefined as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('TicketAttachmentsService', () => {
  let service: TicketAttachmentsService;
  let prisma: {
    ticketAttachment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock<Promise<unknown>, [TicketAttachmentCreateArgs]>;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let ticketsService: { assertExists: jest.Mock };
  let storage: { save: jest.Mock; remove: jest.Mock; createStream: jest.Mock };

  beforeEach(async () => {
    prisma = {
      ticketAttachment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn<Promise<unknown>, [TicketAttachmentCreateArgs]>(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    ticketsService = {
      assertExists: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };
    storage = {
      save: jest.fn().mockResolvedValue({
        storageKey: 'tickets/ticket-1/uuid.png',
        checksumSha256: 'a'.repeat(64),
        sizeBytes: 128,
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      createStream: jest.fn(),
    };

    const configService = {
      get: () => 10 * 1024 * 1024,
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketAttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: ticketsService },
        { provide: AttachmentStorageService, useValue: storage },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TicketAttachmentsService>(TicketAttachmentsService);
  });

  describe('create', () => {
    it('throws for an unsupported mime type before storage.save is called', async () => {
      const caller = buildCaller();
      const file = buildFile({ mimetype: 'image/svg+xml' });

      await expect(service.create('ticket-1', file, caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('calls storage.save with the "tickets" folder and the ticketId as scope', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.create.mockResolvedValue(baseAttachmentRow);

      await service.create('ticket-1', buildFile(), caller);

      expect(storage.save).toHaveBeenCalledWith(
        'tickets',
        'ticket-1',
        expect.anything(),
        'image/png',
      );
    });

    it('succeeds for the 20th attachment and throws for the 21st', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.create.mockResolvedValue(baseAttachmentRow);

      prisma.ticketAttachment.count.mockResolvedValue(MAX_ATTACHMENTS_PER_TICKET - 1);
      await expect(service.create('ticket-1', buildFile(), caller)).resolves.toBeDefined();

      prisma.ticketAttachment.count.mockResolvedValue(MAX_ATTACHMENTS_PER_TICKET);
      await expect(service.create('ticket-1', buildFile(), caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('removes the just-written file and rethrows when the insert fails, in write-then-insert-then-compensate order', async () => {
      const caller = buildCaller();
      const dbError = new Error('insert failed');
      prisma.ticketAttachment.create.mockRejectedValue(dbError);

      await expect(service.create('ticket-1', buildFile(), caller)).rejects.toBe(dbError);

      const saveOrder = storage.save.mock.invocationCallOrder[0];
      const createOrder = prisma.ticketAttachment.create.mock.invocationCallOrder[0];
      const removeOrder = storage.remove.mock.invocationCallOrder[0];
      expect(saveOrder).toBeLessThan(createOrder);
      expect(createOrder).toBeLessThan(removeOrder);
      expect(storage.remove).toHaveBeenCalledWith('tickets/ticket-1/uuid.png');
    });

    it('sanitises a traversal-shaped originalname into one with no / or \\', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.create.mockResolvedValue(baseAttachmentRow);

      await service.create('ticket-1', buildFile({ originalname: '../../evil.png' }), caller);

      const createArgs = prisma.ticketAttachment.create.mock.calls[0][0];
      expect(createArgs.data.fileName).not.toMatch(/[/\\]/);
    });

    it('falls back to "attachment" for an empty originalname', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.create.mockResolvedValue(baseAttachmentRow);

      await service.create('ticket-1', buildFile({ originalname: '' }), caller);

      const createArgs = prisma.ticketAttachment.create.mock.calls[0][0];
      expect(createArgs.data.fileName).toBe('attachment');
    });
  });

  describe('remove', () => {
    it('deletes the row before calling storage.remove', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.findFirst.mockResolvedValue(baseAttachmentRow);
      prisma.ticketAttachment.delete.mockResolvedValue(baseAttachmentRow);

      await service.remove('ticket-1', 'attachment-1', caller);

      const deleteOrder = prisma.ticketAttachment.delete.mock.invocationCallOrder[0];
      const removeOrder = storage.remove.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(removeOrder);
    });

    it('still resolves when storage.remove rejects', async () => {
      const caller = buildCaller();
      prisma.ticketAttachment.findFirst.mockResolvedValue(baseAttachmentRow);
      prisma.ticketAttachment.delete.mockResolvedValue(baseAttachmentRow);
      storage.remove.mockRejectedValue(new Error('disk error'));

      await expect(service.remove('ticket-1', 'attachment-1', caller)).resolves.toBeUndefined();
    });

    it('throws for a stranger without tickets:manage', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: ['tickets:read'] });
      prisma.ticketAttachment.findFirst.mockResolvedValue(baseAttachmentRow);

      await expect(service.remove('ticket-1', 'attachment-1', caller)).rejects.toThrow();
    });

    it('succeeds for a stranger with tickets:manage', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: ['tickets:manage'] });
      prisma.ticketAttachment.findFirst.mockResolvedValue(baseAttachmentRow);
      prisma.ticketAttachment.delete.mockResolvedValue(baseAttachmentRow);

      await expect(service.remove('ticket-1', 'attachment-1', caller)).resolves.toBeUndefined();
    });
  });
});
