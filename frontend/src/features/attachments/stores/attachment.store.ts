import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Attachment } from '../types';
import { QueryState } from '@/core/api/contracts/QueryState';

export const useAttachmentStore = defineStore('attachment', () => {
  const attachments = ref<Attachment[]>([]);
  const queryState = ref<QueryState>(QueryState.Idle);
  const error = ref<string | null>(null);

  const setAttachments = (list: Attachment[]) => {
    attachments.value = list;
  };

  const removeAttachment = (id: string) => {
    attachments.value = attachments.value.filter(a => a.id !== id);
  };

  const setQueryState = (state: QueryState) => {
    queryState.value = state;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const reset = () => {
    attachments.value = [];
    queryState.value = QueryState.Idle;
    error.value = null;
  };

  return {
    attachments,
    queryState,
    error,
    setAttachments,
    removeAttachment,
    setQueryState,
    setError,
    reset,
  };
});

export default useAttachmentStore;
