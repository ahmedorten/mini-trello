export interface Attachment {
  id: string;
  cardId: string;
  fileName: string;
  fileSize: number;
  mimetype: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AttachmentResponse {
  id: string;
  cardId: string;
  fileName: string;
  fileSize: number;
  mimetype: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
