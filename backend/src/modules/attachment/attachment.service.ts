import { ActivityAction } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/errors/app-error';
import { LocalStorageService } from '../../shared/utils/storage.service';
import {
  ActivityService,
  AttachmentAddedDetails,
  AttachmentUpdatedDetails,
  AttachmentDeletedDetails,
} from '../activity/activity.service';
import { UpdateAttachmentInput } from './attachment.schema';

export interface AttachmentResponse {
  id: string;
  cardId: string;
  fileName: string;
  fileSize: number | null;
  mimetype: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  downloadUrl: string;
}

const attachmentSelect = {
  id: true,
  cardId: true,
  fileName: true,
  fileSize: true,
  mimetype: true,
  storageKey: true,
  createdAt: true,
  updatedAt: true,
  version: true,
};

export class AttachmentService {
  private readonly storageService = new LocalStorageService();
  private readonly activityService = new ActivityService();

  public async createAttachment(
    cardId: string,
    userId: string,
    fileName: string,
    mimetype: string,
    fileSize: number,
    fileBuffer: Buffer
  ): Promise<AttachmentResponse> {
    // 1. Verify Card exists and is owned by the user
    await this.getOwnedCard(cardId, userId);

    // 2. Upload file to physical storage
    const storageKey = await this.storageService.upload(fileName, mimetype, fileBuffer);

    try {
      // 3. Save attachment details and activity log inside a transaction
      const attachment = await prisma.$transaction(async (tx) => {
        const nextAttachment = await tx.attachment.create({
          data: {
            cardId,
            fileName,
            storageKey,
            fileSize,
            mimetype,
            createdBy: userId,
            updatedBy: userId,
          },
          select: attachmentSelect,
        });

        await this.activityService.log(
          cardId,
          userId,
          ActivityAction.ATTACHMENT_ADDED,
          {
            attachmentId: nextAttachment.id,
            fileName: nextAttachment.fileName,
            mimetype: nextAttachment.mimetype,
            fileSize: nextAttachment.fileSize,
          } satisfies AttachmentAddedDetails,
          tx
        );

        return nextAttachment;
      });

      return this.formatAttachment(attachment);
    } catch (error) {
      // 4. Compensating transaction: clean up physical file on DB failure
      await this.storageService.delete(storageKey);
      throw error;
    }
  }

  public async getAttachments(cardId: string, userId: string): Promise<AttachmentResponse[]> {
    await this.getOwnedCard(cardId, userId);

    const attachments = await prisma.attachment.findMany({
      where: {
        cardId,
        isDeleted: false,
      },
      select: attachmentSelect,
      orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    });

    return attachments.map((att) => this.formatAttachment(att));
  }

  public async getAttachment(id: string, userId: string): Promise<AttachmentResponse> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id,
        isDeleted: false,
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
      },
      select: attachmentSelect,
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    return this.formatAttachment(attachment);
  }

  public async downloadAttachment(
    id: string,
    userId: string
  ): Promise<{ filePath: string; fileName: string; mimetype: string | null }> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id,
        isDeleted: false,
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
      },
      select: {
        fileName: true,
        mimetype: true,
        storageKey: true,
      },
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    const filePath = this.storageService.getFilePath(attachment.storageKey);
    return {
      filePath,
      fileName: attachment.fileName,
      mimetype: attachment.mimetype,
    };
  }

  public async updateAttachment(
    id: string,
    userId: string,
    input: UpdateAttachmentInput
  ): Promise<AttachmentResponse> {
    const existing = await prisma.attachment.findFirst({
      where: {
        id,
        isDeleted: false,
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
      },
      select: attachmentSelect,
    });

    if (!existing) {
      throw new AppError('Attachment not found', 404);
    }

    // Change Detection / No-op rename check
    if (existing.fileName === input.fileName) {
      return this.formatAttachment(existing);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextAttachment = await tx.attachment.update({
        where: { id },
        data: {
          fileName: input.fileName,
          updatedBy: userId,
          version: { increment: 1 },
        },
        select: attachmentSelect,
      });

      await this.activityService.log(
        nextAttachment.cardId,
        userId,
        ActivityAction.ATTACHMENT_UPDATED,
        {
          attachmentId: id,
          oldFileName: existing.fileName,
          newFileName: nextAttachment.fileName,
        } satisfies AttachmentUpdatedDetails,
        tx
      );

      return nextAttachment;
    });

    return this.formatAttachment(updated);
  }

  public async deleteAttachment(id: string, userId: string): Promise<null> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id,
        isDeleted: false,
        card: {
          isDeleted: false,
          column: {
            isDeleted: false,
            board: {
              ownerId: userId,
              isDeleted: false,
            },
          },
        },
      },
      select: {
        id: true,
        cardId: true,
        fileName: true,
        storageKey: true,
      },
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      await this.activityService.log(
        attachment.cardId,
        userId,
        ActivityAction.ATTACHMENT_DELETED,
        {
          attachmentId: id,
          fileName: attachment.fileName,
        } satisfies AttachmentDeletedDetails,
        tx
      );
    });

    try {
      // Delete physical file from storage provider after DB commit
      await this.storageService.delete(attachment.storageKey);
    } catch (error) {
      // Log physical file deletion failure for background retry queue
      console.error(
        `Failed to physically delete storage key ${attachment.storageKey} for attachment ${id}:`,
        error
      );
    }

    return null;
  }

  private async getOwnedCard(cardId: string, userId: string): Promise<void> {
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        isDeleted: false,
        column: {
          isDeleted: false,
          board: {
            ownerId: userId,
            isDeleted: false,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }
  }

  private formatAttachment(att: {
    id: string;
    cardId: string;
    fileName: string;
    fileSize: number | null;
    mimetype: string | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    storageKey: string;
  }): AttachmentResponse {
    // Generate transient public download URL without exposing raw storageKey
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const downloadUrl = `${baseUrl}/api/v1/attachments/${att.id}/download`;

    return {
      id: att.id,
      cardId: att.cardId,
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimetype: att.mimetype,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      version: att.version,
      downloadUrl,
    };
  }
}
