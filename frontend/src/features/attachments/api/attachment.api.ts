import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import type { AttachmentResponse } from '../types';

export class AttachmentApi {
  public static async listAttachments(cardId: string): Promise<ApiResult<AttachmentResponse[]>> {
    return apiClient.get<AttachmentResponse[]>(`/cards/${cardId}/attachments`);
  }

  public static async deleteAttachment(id: string): Promise<ApiResult<null>> {
    return apiClient.delete<null>(`/attachments/${id}`);
  }

  public static async downloadAttachmentBlob(id: string): Promise<ApiResult<Blob>> {
    return apiClient.get<Blob>(`/attachments/${id}/download`, {
      responseType: 'blob',
    });
  }
}

export default AttachmentApi;
