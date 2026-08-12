<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAttachments } from '../composables/useAttachments';
import AttachmentItem from './AttachmentItem.vue';
import { ToastService } from '@/shared/services/ToastService';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import { QueryState } from '@/core/api/contracts/QueryState';
import { PaperClipIcon, XCircleIcon } from '@heroicons/vue/24/outline';
import axios from 'axios';
import type { CancelTokenSource } from 'axios';

const props = defineProps<{
  cardId: string;
}>();

const {
  attachments,
  queryState,
  loadAttachments,
  uploadFile,
  removeAttachment,
} = useAttachments();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const cancelSource = ref<CancelTokenSource | null>(null);

const load = async () => {
  try {
    await loadAttachments(props.cardId);
  } catch (e: any) {
    console.error('Failed to load attachments:', e);
  }
};

onMounted(load);
watch(() => props.cardId, load);

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;
  const file = target.files[0];

  isUploading.value = true;
  uploadProgress.value = 0;
  cancelSource.value = axios.CancelToken.source();

  try {
    await uploadFile(props.cardId, file, {
      cancelTokenSource: cancelSource.value,
      onProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        }
      },
    });
    ToastService.success('File uploaded successfully.');
  } catch (err: any) {
    if (err?.message === 'Upload cancelled.') {
      ToastService.info('Upload cancelled.');
    } else {
      ToastService.error(err?.message || 'Failed to upload file.');
    }
  } finally {
    isUploading.value = false;
    cancelSource.value = null;
    uploadProgress.value = 0;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
};

const cancelActiveUpload = () => {
  if (cancelSource.value) {
    cancelSource.value.cancel('Upload cancelled.');
  }
};

const handleDeleteAttachment = async (attachmentId: string) => {
  if (!confirm('Are you sure you want to delete this attachment?')) return;
  try {
    await removeAttachment(props.cardId, attachmentId);
    ToastService.success('Attachment deleted.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to delete attachment.');
  }
};
</script>

<template>
  <div class="space-y-4 select-none">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-100 pb-2">
      <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
        <PaperClipIcon class="h-4 w-4 text-gray-400" />
        <span>Attachments ({{ attachments.length }})</span>
      </h4>

      <button
        type="button"
        @click="triggerFileInput"
        :disabled="isUploading"
        class="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-0.5 focus:outline-none disabled:opacity-50"
      >
        <span>Upload File</span>
      </button>

      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- Upload Progress Indicator -->
    <div v-if="isUploading" class="bg-gray-50 border border-gray-200/60 p-3 rounded-xl space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-gray-500 uppercase">Uploading file...</span>
        <button
          type="button"
          @click="cancelActiveUpload"
          class="text-red-500 hover:text-red-600 flex items-center space-x-0.5 text-xs font-semibold focus:outline-none"
        >
          <XCircleIcon class="h-3.5 w-3.5" />
          <span>Cancel</span>
        </button>
      </div>

      <div class="flex items-center space-x-2">
        <span class="text-[10px] font-bold text-gray-400 w-8">{{ uploadProgress }}%</span>
        <div class="flex-1 h-1.5 bg-gray-150 rounded-full overflow-hidden">
          <div
            class="h-full bg-brand-500 rounded-full transition-all duration-150"
            :style="{ width: `${uploadProgress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Attachments List Grid -->
    <div class="relative min-h-[50px]">
      <div v-if="queryState === QueryState.Loading && attachments.length === 0" class="flex items-center justify-center py-4">
        <BaseSpinner size="sm" message="Loading attachments..." />
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
        <AttachmentItem
          v-for="item in attachments"
          :key="item.id"
          :item="item"
          @delete="handleDeleteAttachment(item.id)"
        />

        <div v-if="attachments.length === 0" class="col-span-full text-center py-6 border border-dashed border-gray-150 rounded-xl bg-gray-50/50">
          <p class="text-[11px] text-gray-400">No attachments uploaded yet.</p>
        </div>
      </div>
    </div>
  </div>
</template>
