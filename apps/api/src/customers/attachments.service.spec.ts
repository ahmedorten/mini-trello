import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CustomerStatus } from '@prisma/client';
import { AttachmentsService, MAX_ATTACHMENTS_PER_CUSTOMER } from './attachments.service';
import { AttachmentStorageService } from '../common/attachment-storage.service';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { EnvironmentVariables } from '../config/env.validation';

const baseAttachmentRow = {
  id: 'attachment-1',
  customerId: 'customer-1',
  fileName: 'contract.pdf',
  mimeType: 'application/pdf',
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
    permissions: ['customers:read', 'attachments:write'],
    ...overrides,
  };
}

interface AttachmentCreateArgs {
  data: { fileName: string };
}

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'contract.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 128,
    buffer: Buffer.from('%PDF-1.4 test'),
    stream: undefined as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: {
    customerAttachment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock<Promise<unknown>, [AttachmentCreateArgs]>;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let customersService: { assertExists: jest.Mock };
  let storage: { save: jest.Mock; remove: jest.Mock; createStream: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customerAttachment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn<Promise<unknown>, [AttachmentCreateArgs]>(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    customersService = {
      assertExists: jest
        .fn()
        .mockResolvedValue({ id: 'customer-1', status: CustomerStatus.ACTIVE }),
    };
    storage = {
      save: jest.fn().mockResolvedValue({
        storageKey: 'customers/customer-1/uuid.pdf',
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
        AttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
        { provide: AttachmentStorageService, useValue: storage },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('create', () => {
    it('throws for an unsupported mime type before storage.save is called', async () => {
      const caller = buildCaller();
      const file = buildFile({ mimetype: 'image/svg+xml' });

      await expect(service.create('customer-1', file, caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('succeeds for the 20th attachment and throws for the 21st', async () => {
      const caller = buildCaller();
      prisma.customerAttachment.create.mockResolvedValue(baseAttachmentRow);

      prisma.customerAttachment.count.mockResolvedValue(MAX_ATTACHMENTS_PER_CUSTOMER - 1);
      await expect(service.create('customer-1', buildFile(), caller)).resolves.toBeDefined();

      prisma.customerAttachment.count.mockResolvedValue(MAX_ATTACHMENTS_PER_CUSTOMER);
      await expect(service.create('customer-1', buildFile(), caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('removes the just-written file and rethrows when the insert fails', async () => {
      const caller = buildCaller();
      const dbError = new Error('insert failed');
      prisma.customerAttachment.create.mockRejectedValue(dbError);

      await expect(service.create('customer-1', buildFile(), caller)).rejects.toBe(dbError);
      expect(storage.remove).toHaveBeenCalledWith('customers/customer-1/uuid.pdf');
    });

    it('sanitises a traversal-shaped originalname into one with no / or \\', async () => {
      const caller = buildCaller();
      prisma.customerAttachment.create.mockResolvedValue(baseAttachmentRow);

      await service.create('customer-1', buildFile({ originalname: '../../evil.pdf' }), caller);

      const createArgs = prisma.customerAttachment.create.mock.calls[0][0];
      expect(createArgs.data.fileName).not.toMatch(/[/\\]/);
    });

    it('falls back to "attachment" for an empty originalname', async () => {
      const caller = buildCaller();
      prisma.customerAttachment.create.mockResolvedValue(baseAttachmentRow);

      await service.create('customer-1', buildFile({ originalname: '' }), caller);

      const createArgs = prisma.customerAttachment.create.mock.calls[0][0];
      expect(createArgs.data.fileName).toBe('attachment');
    });
  });

  describe('remove', () => {
    it('deletes the row before calling storage.remove', async () => {
      const caller = buildCaller();
      prisma.customerAttachment.findFirst.mockResolvedValue(baseAttachmentRow);
      prisma.customerAttachment.delete.mockResolvedValue(baseAttachmentRow);

      await service.remove('customer-1', 'attachment-1', caller);

      const deleteOrder = prisma.customerAttachment.delete.mock.invocationCallOrder[0];
      const removeOrder = storage.remove.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(removeOrder);
    });

    it('still resolves when storage.remove rejects', async () => {
      const caller = buildCaller();
      prisma.customerAttachment.findFirst.mockResolvedValue(baseAttachmentRow);
      prisma.customerAttachment.delete.mockResolvedValue(baseAttachmentRow);
      storage.remove.mockRejectedValue(new Error('disk error'));

      await expect(service.remove('customer-1', 'attachment-1', caller)).resolves.toBeUndefined();
    });
  });
});
