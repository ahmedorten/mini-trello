<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useColumnForm } from '../composables/useColumnForm';
import { ColumnService } from '../services/column.service';
import { ToastService } from '@/shared/services/ToastService';
import type { Column } from '../types/models/Column';
import { EllipsisHorizontalIcon, TrashIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  column: Column;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
}>();

const isEditing = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const showMenu = ref(false);

const {
  handleSubmit,
  errors,
  isSubmitting,
  name,
  nameProps,
  resetForm,
} = useColumnForm();

const startEdit = () => {
  isEditing.value = true;
  resetForm({
    values: {
      name: props.column.name,
    },
  });
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
};

const cancelEdit = () => {
  isEditing.value = false;
};

const handleRename = handleSubmit(async (values) => {
  if (values.name === props.column.name) {
    isEditing.value = false;
    return;
  }
  
  try {
    await ColumnService.renameColumn(props.column.id, values.name);
    isEditing.value = false;
    ToastService.success('Column renamed.');
  } catch (error: any) {
    ToastService.error(error?.message || 'Failed to rename column.');
  }
});
</script>

<template>
  <div class="flex items-center justify-between px-3 py-2 select-none group/header relative column-drag-handle cursor-grab active:cursor-grabbing">

    <!-- 1. Inline edit name mode -->
    <form
      v-if="isEditing"
      @submit.prevent="handleRename"
      class="w-full flex items-center pr-2"
    >
      <input
        ref="inputRef"
        v-model="name"
        v-bind="nameProps"
        type="text"
        @blur="handleRename"
        @keydown.esc="cancelEdit"
        class="w-full px-2 py-1 text-sm font-bold text-gray-900 border border-brand-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all bg-white"
        aria-label="Column Name"
        :aria-invalid="!!errors.name"
        :disabled="isSubmitting"
      />
    </form>

    <!-- 2. Display name mode -->
    <div
      v-else
      @click="startEdit"
      class="flex-1 text-sm font-bold text-gray-900 cursor-pointer hover:bg-gray-100/80 px-2 py-1 rounded-lg transition-colors truncate"
      title="Click to edit column name"
    >
      {{ column.name }}
    </div>

    <!-- 3. Deletion actions dropdown trigger -->
    <div class="relative flex items-center">
      <button
        type="button"
        @click="showMenu = !showMenu"
        class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Column Options Menu"
        :aria-expanded="showMenu"
      >
        <EllipsisHorizontalIcon class="h-5 w-5" />
      </button>

      <!-- Deletion menu dropdown -->
      <div
        v-if="showMenu"
        class="absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-white border border-gray-150 shadow-lg ring-1 ring-black/5 z-20 focus:outline-none"
        role="menu"
        tabindex="-1"
      >
        <div class="py-1">
          <button
            type="button"
            @click="emit('delete'); showMenu = false;"
            class="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-medium focus:outline-none"
            role="menuitem"
          >
            <TrashIcon class="h-4.5 w-4.5" />
            <span>Delete Column</span>
          </button>
        </div>
      </div>

      <!-- Backdrop overlay click detector to close menu -->
      <div
        v-if="showMenu"
        @click="showMenu = false"
        class="fixed inset-0 z-10 bg-transparent"
      ></div>
    </div>
  </div>
</template>
