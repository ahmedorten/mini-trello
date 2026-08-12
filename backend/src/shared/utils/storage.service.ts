import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageService {
  upload(fileName: string, mimeType: string, fileBuffer: Buffer): Promise<string>;
  delete(storageKey: string): Promise<void>;
  generatePublicUrl(storageKey: string, attachmentId: string): Promise<string>;
}

export class LocalStorageService implements StorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async upload(fileName: string, _mimeType: string, fileBuffer: Buffer): Promise<string> {
    const fileExt = path.extname(fileName);
    const uniqueName = `${crypto.randomUUID()}${fileExt}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    await fs.promises.writeFile(filePath, fileBuffer);

    return uniqueName; // uniqueName acts as our storageKey
  }

  public async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  public async generatePublicUrl(_storageKey: string, attachmentId: string): Promise<string> {
    return `${this.baseUrl}/api/v1/attachments/${attachmentId}/download`;
  }

  public getFilePath(storageKey: string): string {
    return path.join(this.uploadDir, storageKey);
  }
}
