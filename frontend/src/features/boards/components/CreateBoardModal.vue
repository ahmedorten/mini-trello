<script setup lang="ts">
import { watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import BaseModal from '@/shared/components/base/BaseModal.vue';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseTextarea from '@/shared/components/base/BaseTextarea.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useBoardForm } from '../composables/useBoardForm';
import { BoardService } from '../services/board.service';
import { useI18n } from '@/shared/composables/useI18n';
import { NotificationCenter } from '@/shared/services/NotificationCenter';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const { t } = useI18n();

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

const handleCreate = handleSubmit(async (values) => {
  try {
    const newBoard = await BoardService.createBoard(values);
    NotificationCenter.toast(t('auth.registerSuccess'), 'success');
    emit('close');
    router.push(`/boards/${newBoard.id}`);
  } catch (error: any) {
    NotificationCenter.toast(error?.message || t('auth.registerSuccess').split(' ')[0] + ' Failed', 'error');
  }
});

watch(() => props.show, (newShow) => {
  if (newShow) {
    resetForm();
  }
});
</script>

<template>
  <BaseModal :show="show" :title="t('boards.createBoard')" @close="emit('close')">
    <form @submit="handleCreate" class="space-y-4" novalidate>
      <BaseInput
        v-model="name"
        v-bind="nameProps"
        :label="t('boards.boardName')"
        :placeholder="t('boards.boardNamePlaceholder')"
        :error="errors.name"
        :disabled="isSubmitting"
        id="create-board-name"
        required
        aria-required="true"
        :aria-invalid="!!errors.name"
        autofocus
      />

      <BaseTextarea
        v-model="descriptionModel"
        v-bind="descriptionProps"
        :label="t('common.description') + ' (' + t('common.optional') + ')'"
        placeholder="Provide summary description..."
        :error="errors.description"
        :disabled="isSubmitting"
        id="create-board-description"
        :rows="3"
        :aria-invalid="!!errors.description"
      />

      <div class="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <BaseButton
          type="button"
          variant="secondary"
          @click="emit('close')"
          :disabled="isSubmitting"
          aria-label="Cancel board creation"
        >
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          aria-label="Submit create board form"
        >
          {{ t('boards.createBoard') }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
