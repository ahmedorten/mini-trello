<script setup lang="ts">
import { watch } from 'vue';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useColumnForm } from '../composables/useColumnForm';
import { ColumnService } from '../services/column.service';
import { ToastService } from '@/shared/services/ToastService';

const props = defineProps<{
  show: boolean;
  boardId: string;
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

const handleCreate = handleSubmit(async (values) => {
  try {
    await ColumnService.createColumn(props.boardId, values);
    ToastService.success('Column created successfully!');
    emit('close');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to create column.');
  }
});

watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm();
  }
});
</script>

<template>
  <BaseModal :show="show" title="Add New Column" @close="emit('close')">
    <form @submit="handleCreate" class="space-y-4" novalidate>
      <BaseInput
        v-model="name"
        v-bind="nameProps"
        label="Column Title"
        placeholder="e.g. To Do"
        :error="errors.name"
        :disabled="isSubmitting"
        id="create-column-name"
        required
        aria-required="true"
        :aria-invalid="!!errors.name"
        autofocus
      />

      <div class="flex justify-end space-x-3 pt-3 border-t border-gray-100">
        <BaseButton
          type="button"
          variant="secondary"
          @click="emit('close')"
          :disabled="isSubmitting"
          aria-label="Cancel column addition"
        >
          Cancel
        </BaseButton>
        <BaseButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          aria-label="Submit add column form"
        >
          Add Column
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
