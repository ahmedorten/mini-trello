import { apiClient } from '@/core/api/ApiClient';
import type { ApiResult } from '@/core/api/ApiResult';
import axios from 'axios';
import type { AxiosProgressEvent, CancelTokenSource } from 'axios';

export interface UploadOptions {
  onProgress?: (progressEvent: AxiosProgressEvent) => void;
  cancelTokenSource?: CancelTokenSource;
}

export class UploadService {
  public static validateFile(file: File, allowedTypes: string[], maxSizeMb: number): string | null {
    if (file.size > maxSizeMb * 1024 * 1024) {
      return `File size exceeds the maximum limit of ${maxSizeMb}MB.`;
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return 'File type is not supported.';
    }
    return null;
  }

  public static async uploadFile<T>(
    url: string,
    file: File,
    options?: UploadOptions
  ): Promise<ApiResult<T>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post<T>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: options?.onProgress,
        cancelToken: options?.cancelTokenSource?.token,
      });
      return response;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        throw new Error('Upload cancelled.');
      }
      throw error;
    }
  }
}

export default UploadService;
