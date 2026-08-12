<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { ColumnService } from '../services/column.service';
import { ToastService } from '@/shared/services/ToastService';
import type { Column } from '../types/models/Column';

const props = defineProps<{
  show: boolean;
  column: Column;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isSubmitting = ref(false);

const handleDelete = async () => {
  isSubmitting.value = true;
  try {
    await ColumnService.deleteColumn(props.column.id);
    ToastService.success('Column deleted successfully.');
    emit('close');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to delete column.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <BaseModal :show="show" title="Delete Column" @close="emit('close')">
    <div class="space-y-4">
      <div class="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200" role="alert">
        <p class="font-bold">Warning: This action is permanent!</p>
        <p class="mt-1">All cards inside the column "{{ column.name }}" will also be deleted.</p>
      </div>

      <p class="text-sm text-gray-600">
        Are you sure you want to permanently delete the column <span class="font-semibold text-gray-900">"{{ column.name }}"</span>?
      </p>

      <div class="flex justify-end space-x-3 pt-3 border-t border-gray-100">
        <BaseButton
          type="button"
          variant="secondary"
          @click="emit('close')"
          :disabled="isSubmitting"
          aria-label="Cancel deletion"
        >
          Cancel
        </BaseButton>
        <BaseButton
          type="button"
          variant="danger"
          @click="handleDelete"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          aria-label="Confirm column deletion"
        >
          Delete Column
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
