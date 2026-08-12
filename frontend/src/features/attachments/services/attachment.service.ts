import { AttachmentApi } from '../api/attachment.api';
import { useAttachmentStore } from '../stores/attachment.store';
import { UploadService } from '@/shared/services/UploadService';
import type { UploadOptions } from '@/shared/services/UploadService';
import { CardRefreshService } from '@/features/cards/services/CardRefreshService';
import { QueryState } from '@/core/api/contracts/QueryState';
import type { AttachmentResponse } from '../types';

export class AttachmentService {
  public static async fetchAttachments(cardId: string): Promise<void> {
    const store = useAttachmentStore();
    store.setQueryState(QueryState.Loading);
    store.setError(null);

    const result = await AttachmentApi.listAttachments(cardId);
    if (result.success) {
      store.setAttachments(result.data);
      store.setQueryState(QueryState.Success);
    } else {
      store.setError(result.error.message);
      store.setQueryState(QueryState.Error);
      throw result.error;
    }
  }

  public static async uploadAttachment(
    cardId: string,
    file: File,
    options?: UploadOptions
  ): Promise<void> {
    // Validate file first (Max 10MB)
    const validationError = UploadService.validateFile(file, [], 10);
    if (validationError) {
      throw new Error(validationError);
    }

    const uploadUrl = `/cards/${cardId}/attachments`;
    const result = await UploadService.uploadFile<AttachmentResponse>(uploadUrl, file, options);
    if (result.success) {
      await this.fetchAttachments(cardId);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async deleteAttachment(cardId: string, id: string): Promise<void> {
    const store = useAttachmentStore();
    const result = await AttachmentApi.deleteAttachment(id);
    if (result.success) {
      store.removeAttachment(id);
      await CardRefreshService.refreshCounters(cardId);
    } else {
      throw result.error;
    }
  }

  public static async downloadAttachment(id: string, fileName: string): Promise<void> {
    const result = await AttachmentApi.downloadAttachmentBlob(id);
    if (result.success) {
      const blob = result.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      throw result.error;
    }
  }

  public static async fetchAttachmentBlob(id: string): Promise<Blob> {
    const result = await AttachmentApi.downloadAttachmentBlob(id);
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }
}

export default AttachmentService;
