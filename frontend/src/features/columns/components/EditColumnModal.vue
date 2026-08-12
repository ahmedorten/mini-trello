<script setup lang="ts">
import { watch } from 'vue';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useColumnForm } from '../composables/useColumnForm';
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

const {
  handleSubmit,
  errors,
  isSubmitting,
  name,
  nameProps,
  resetForm,
} = useColumnForm();

const handleUpdate = handleSubmit(async (values) => {
  try {
    await ColumnService.renameColumn(props.column.id, values.name);
    ToastService.success('Column title updated.');
    emit('close');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to update column.');
  }
});

watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm({
      values: {
        name: props.column.name,
      },
    });
  }
});
</script>

<template>
  <BaseModal :show="show" title="Rename Column" @close="emit('close')">
    <form @submit="handleUpdate" class="space-y-4" novalidate>
      <BaseInput
        v-model="name"
        v-bind="nameProps"
        label="Column Title"
        placeholder="e.g. In Progress"
        :error="errors.name"
        :disabled="isSubmitting"
        id="edit-column-name"
        required
        aria-required="true"
        :aria-invalid="!!errors.name"
      />

      <div class="flex justify-end space-x-3 pt-3 border-t border-gray-100">
        <BaseButton
          type="button"
          variant="secondary"
          @click="emit('close')"
          :disabled="isSubmitting"
          aria-label="Cancel renaming"
        >
          Cancel
        </BaseButton>
        <BaseButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          aria-label="Save column title modifications"
        >
          Save Changes
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
