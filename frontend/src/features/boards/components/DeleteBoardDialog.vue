<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
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

const router = useRouter();
const confirmationInput = ref('');
const isSubmitting = ref(false);

const handleDelete = async () => {
  if (confirmationInput.value !== props.board.name) {
    return;
  }

  isSubmitting.value = true;
  try {
    await BoardService.deleteBoard(props.board.id);
    ToastService.success('Board deleted successfully.');
    emit('close');
    router.push('/boards');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to delete board.');
  } finally {
    isSubmitting.value = false;
  }
};

watch(() => props.show, (newShow) => {
  if (newShow) {
    confirmationInput.value = '';
  }
});
</script>

<template>
  <BaseModal :show="show" title="Delete Board" @close="emit('close')">
    <div class="space-y-4">
      <div class="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200" role="alert">
        <p class="font-bold">Warning: This action is permanent and cannot be undone!</p>
        <p class="mt-1">All columns and cards associated with this board will also be permanently deleted.</p>
      </div>

      <p class="text-sm text-gray-600">
        To confirm, please type <span class="font-semibold text-gray-900 select-all">"{{ board.name }}"</span> in the box below:
      </p>

      <form @submit.prevent="handleDelete" class="space-y-4" novalidate>
        <BaseInput
          v-model="confirmationInput"
          placeholder="Type board name to confirm"
          :disabled="isSubmitting"
          id="delete-board-confirm"
          required
          aria-required="true"
        />

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
            type="submit"
            variant="danger"
            :loading="isSubmitting"
            :disabled="isSubmitting || confirmationInput !== board.name"
            aria-label="Confirm permanent board deletion"
          >
            Permanently Delete
          </BaseButton>
        </div>
      </form>
    </div>
  </BaseModal>
</template>
