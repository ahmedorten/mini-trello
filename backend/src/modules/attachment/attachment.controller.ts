import { Request, Response, NextFunction } from 'express';
import 'multer';
import { AttachmentService } from './attachment.service';
import { AppError } from '../../shared/errors/app-error';
import config from '../../config';

const attachmentService = new AttachmentService();

export class AttachmentController {
  public async create(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const file = req.file;
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      // Metadata validations loaded from configuration
      if (file.originalname.length > config.maxFilenameLength) {
        throw new AppError(
          `Filename is too long (maximum is ${config.maxFilenameLength} characters)`,
          400
        );
      }

      if (file.size > config.maxFileSize) {
        throw new AppError(
          `File size exceeds maximum allowed limit of ${config.maxFileSize} bytes`,
          400
        );
      }

      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        throw new AppError(`Mime type ${file.mimetype} is not allowed`, 400);
      }

      const attachment = await attachmentService.createAttachment(
        req.params.cardId,
        req.user.id,
        file.originalname,
        file.mimetype,
        file.size,
        file.buffer
      );

      res.status(201).json({
        success: true,
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(
    req: Request<{ cardId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const attachments = await attachmentService.getAttachments(req.params.cardId, req.user.id);

      res.status(200).json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const attachment = await attachmentService.getAttachment(req.params.id, req.user.id);

      res.status(200).json({
        success: true,
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }

  public async download(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const fileInfo = await attachmentService.downloadAttachment(req.params.id, req.user.id);

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`
      );
      if (fileInfo.mimetype) {
        res.setHeader('Content-Type', fileInfo.mimetype);
      }

      res.download(fileInfo.filePath, fileInfo.fileName, (err) => {
        if (err) {
          next(new AppError('Failed to download file', 500));
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public async update(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const attachment = await attachmentService.updateAttachment(
        req.params.id,
        req.user.id,
        req.body
      );

      res.status(200).json({
        success: true,
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }

  public async delete(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      await attachmentService.deleteAttachment(req.params.id, req.user.id);

      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}
