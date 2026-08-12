<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import type { Attachment } from '../types';
import { useAttachments } from '../composables/useAttachments';
import { TrashIcon, ArrowDownTrayIcon, DocumentIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';

const props = defineProps<{
  item: Attachment;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
}>();

const { downloadFile, getFileBlob } = useAttachments();

const previewUrl = ref<string | null>(null);
const isPreviewLoading = ref(false);

const isImage = computed(() => {
  return props.item.mimetype?.startsWith('image/');
});

const formattedSize = computed(() => {
  const bytes = props.item.fileSize;
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
});

const revokePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
};

const loadPreview = async () => {
  if (!isImage.value) return;
  isPreviewLoading.value = true;
  try {
    const blob = await getFileBlob(props.item.id);
    revokePreview();
    previewUrl.value = URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to load image preview:', err);
  } finally {
    isPreviewLoading.value = false;
  }
};

onMounted(loadPreview);
watch(() => props.item.id, loadPreview);

onBeforeUnmount(revokePreview);
</script>

<template>
  <div class="flex items-center space-x-3.5 p-2.5 border border-gray-150 rounded-2xl bg-white shadow-xs select-none">
    <!-- Thumbnail Preview / Icon Box -->
    <div class="h-14 w-18 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
      <div v-if="isPreviewLoading" class="flex items-center justify-center">
        <BaseSpinner size="sm" />
      </div>
      <template v-else-if="isImage && previewUrl">
        <img :src="previewUrl" alt="Preview" class="h-full w-full object-cover" />
      </template>
      <template v-else>
        <component
          :is="isImage ? PhotoIcon : DocumentIcon"
          class="h-6 w-6 text-gray-400"
        />
      </template>
    </div>

    <!-- Details Column -->
    <div class="flex-1 min-w-0">
      <p class="text-xs font-bold text-gray-800 truncate" :title="item.fileName">
        {{ item.fileName }}
      </p>
      <p class="text-[10px] text-gray-400 font-semibold mt-0.5">
        {{ formattedSize }}
      </p>
    </div>

    <!-- Actions Column -->
    <div class="flex items-center space-x-1.5 flex-shrink-0">
      <button
        type="button"
        @click="downloadFile(item.id, item.fileName)"
        class="p-1.5 border border-gray-100 hover:border-brand-200 rounded-lg text-gray-400 hover:text-brand-600 transition-colors focus:outline-none bg-white"
        title="Download file"
      >
        <ArrowDownTrayIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        @click="emit('delete')"
        class="p-1.5 border border-gray-100 hover:border-red-200 rounded-lg text-gray-400 hover:text-red-600 transition-colors focus:outline-none bg-white"
        title="Delete file"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
