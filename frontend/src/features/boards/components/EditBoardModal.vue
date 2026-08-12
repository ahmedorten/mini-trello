<script setup lang="ts">
import { watch, computed } from 'vue';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseTextarea from '@/shared/components/base/BaseTextarea.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useBoardForm } from '../composables/useBoardForm';
import { BoardService } from '../services/board.service';
import { ToastService } from '@/shared/services/ToastService';
import type { Board } from '../types/models/Board';

const props = defineProps<{
  show: boolean;
  board: Board;
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
  description,
  descriptionProps,
  resetForm,
} = useBoardForm();

const descriptionModel = computed({
  get: () => description.value || '',
  set: (val) => {
    description.value = val;
  },
});

const handleUpdate = handleSubmit(async (values) => {
  try {
    await BoardService.updateBoard(props.board.id, values);
    ToastService.success('Board details updated successfully!');
    emit('close');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to update board details.');
  }
});

watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm({
      values: {
        name: props.board.name,
        description: props.board.description || '',
      },
    });
  }
});
</script>

<template>
  <BaseModal :show="show" title="Edit Board Details" @close="emit('close')">
    <form @submit="handleUpdate" class="space-y-4" novalidate>
      <BaseInput
        v-model="name"
        v-bind="nameProps"
        label="Board Name"
        placeholder="e.g. Project Alpha"
        :error="errors.name"
        :disabled="isSubmitting"
        id="edit-board-name"
        required
        aria-required="true"
        :aria-invalid="!!errors.name"
      />

      <BaseTextarea
        v-model="descriptionModel"
        v-bind="descriptionProps"
        label="Description"
        placeholder="Provide a brief summary of this board..."
        :error="errors.description"
        :disabled="isSubmitting"
        id="edit-board-description"
        :rows="3"
        :aria-invalid="!!errors.description"
      />

      <div class="flex justify-end space-x-3 pt-3 border-t border-gray-100">
        <BaseButton
          type="button"
          variant="secondary"
          @click="emit('close')"
          :disabled="isSubmitting"
          aria-label="Cancel editing board details"
        >
          Cancel
        </BaseButton>
        <BaseButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          aria-label="Save board details updates"
        >
          Save Changes
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
