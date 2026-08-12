import { computed } from 'vue';
import { useAttachmentStore } from '../stores/attachment.store';
import { AttachmentService } from '../services/attachment.service';
import type { UploadOptions } from '@/shared/services/UploadService';

export function useAttachments() {
  const store = useAttachmentStore();

  const attachments = computed(() => store.attachments);
  const queryState = computed(() => store.queryState);
  const error = computed(() => store.error);

  const loadAttachments = async (cardId: string) => {
    await AttachmentService.fetchAttachments(cardId);
  };

  const uploadFile = async (cardId: string, file: File, options?: UploadOptions) => {
    await AttachmentService.uploadAttachment(cardId, file, options);
  };

  const removeAttachment = async (cardId: string, id: string) => {
    await AttachmentService.deleteAttachment(cardId, id);
  };

  const downloadFile = async (id: string, fileName: string) => {
    await AttachmentService.downloadAttachment(id, fileName);
  };

  const getFileBlob = async (id: string): Promise<Blob> => {
    return AttachmentService.fetchAttachmentBlob(id);
  };

  return {
    attachments,
    queryState,
    error,
    loadAttachments,
    uploadFile,
    removeAttachment,
    downloadFile,
    getFileBlob,
  };
}

export default useAttachments;
