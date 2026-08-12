<script setup lang="ts">
import { useCardForm } from '../composables/useCardForm';
import { CardService } from '../services/card.service';
import { ToastService } from '@/shared/services/ToastService';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  show: boolean;
  columnId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const {
  handleSubmit,
  errors,
  isSubmitting,
  title,
  titleProps,
  description,
  descriptionProps,
  priority,
  priorityProps,
  dueDate,
  dueDateProps,
  resetForm,
} = useCardForm();

const handleClose = () => {
  resetForm();
  emit('close');
};

const handleCreateCard = handleSubmit(async (values) => {
  try {
    await CardService.createCard(props.columnId, {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      priority: values.priority,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
    });
    ToastService.success('Card created.');
    handleClose();
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to create card.');
  }
});
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center select-none"
    role="dialog"
    aria-modal="true"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="handleClose"
    ></div>

    <!-- Modal Box Container -->
    <div class="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col z-10 p-6 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-gray-150">
        <h3 class="text-base font-bold text-gray-900 leading-none">
          Add New Card
        </h3>
        <button
          type="button"
          @click="handleClose"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleCreateCard" class="space-y-4 pt-4">
        <!-- Card Title -->
        <div class="flex flex-col space-y-1.5">
          <label for="new-card-title" class="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Title <span class="text-red-500">*</span>
          </label>
          <input
            id="new-card-title"
            v-model="title"
            v-bind="titleProps"
            type="text"
            placeholder="Enter card title..."
            class="text-sm border border-gray-250 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
            :aria-invalid="!!errors.title"
          />
          <span v-if="errors.title" class="text-xs font-semibold text-red-600 leading-none">
            {{ errors.title }}
          </span>
        </div>

        <!-- Description -->
        <div class="flex flex-col space-y-1.5">
          <label for="new-card-desc" class="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Description
          </label>
          <textarea
            id="new-card-desc"
            v-model="description"
            v-bind="descriptionProps"
            rows="3"
            placeholder="Enter description..."
            class="text-sm border border-gray-250 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
          ></textarea>
        </div>

        <!-- Priority and Due Date Row -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Priority dropdown -->
          <div class="flex flex-col space-y-1.5">
            <label for="new-card-priority" class="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Priority
            </label>
            <select
              id="new-card-priority"
              v-model="priority"
              v-bind="priorityProps"
              class="text-sm border border-gray-255 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white cursor-pointer"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <!-- Due Date input -->
          <div class="flex flex-col space-y-1.5">
            <label for="new-card-due-date" class="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Due Date
            </label>
            <input
              id="new-card-due-date"
              v-model="dueDate"
              v-bind="dueDateProps"
              type="date"
              class="text-sm border border-gray-255 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white cursor-pointer"
            />
          </div>
        </div>

        <!-- Submittal Actions -->
        <div class="flex items-center justify-end space-x-2 pt-4 border-t border-gray-150">
          <BaseButton
            type="button"
            variant="secondary"
            size="sm"
            @click="handleClose"
            :disabled="isSubmitting"
          >
            Cancel
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            size="sm"
            :disabled="isSubmitting"
          >
            Add Card
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
