<script setup lang="ts">
import { ref } from 'vue';
import type { ChecklistItem } from '../types';
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  item: ChecklistItem;
}>();

const emit = defineEmits<{
  (e: 'toggle', isCompleted: boolean): void;
  (e: 'rename', title: string): void;
  (e: 'delete'): void;
}>();

const isEditing = ref(false);
const editTitle = ref(props.item.title);

const startEdit = () => {
  editTitle.value = props.item.title;
  isEditing.value = true;
};

const handleSave = () => {
  const trimmed = editTitle.value.trim();
  if (trimmed && trimmed !== props.item.title) {
    emit('rename', trimmed);
  }
  isEditing.value = false;
};
</script>

<template>
  <div class="flex items-start space-x-3 py-1 group/item select-none">
    <!-- Checkbox Toggle -->
    <button
      type="button"
      @click="emit('toggle', !item.isCompleted)"
      class="h-5 w-5 border border-gray-250 hover:border-brand-500 rounded-lg flex items-center justify-center transition-all bg-white cursor-pointer mt-0.5"
    >
      <CheckIcon v-if="item.isCompleted" class="h-3.5 w-3.5 text-brand-600 font-bold" />
    </button>

    <!-- Content / Edit Section -->
    <div class="flex-1 min-w-0">
      <div v-if="isEditing" class="flex items-center space-x-2">
        <input
          v-model="editTitle"
          type="text"
          class="text-xs text-gray-700 border border-brand-500 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white w-full"
          @keydown.enter="handleSave"
          @keydown.escape="isEditing = false"
        />
        <button
          type="button"
          @click="handleSave"
          class="p-1 hover:text-brand-600 transition-colors focus:outline-none"
        >
          <CheckIcon class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          @click="isEditing = false"
          class="p-1 hover:text-gray-500 transition-colors focus:outline-none"
        >
          <XMarkIcon class="h-3.5 w-3.5" />
        </button>
      </div>

      <div v-else class="flex items-center justify-between">
        <span
          class="text-xs text-gray-700 font-medium break-all"
          :class="{ 'line-through text-gray-400': item.isCompleted }"
        >
          {{ item.title }}
        </span>

        <!-- Hover Actions -->
        <div class="flex items-center space-x-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
          <button
            type="button"
            @click="startEdit"
            class="text-gray-400 hover:text-brand-600 transition-colors p-0.5 focus:outline-none"
            title="Rename item"
          >
            <PencilIcon class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            @click="emit('delete')"
            class="text-gray-400 hover:text-red-600 transition-colors p-0.5 focus:outline-none"
            title="Delete item"
          >
            <TrashIcon class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
