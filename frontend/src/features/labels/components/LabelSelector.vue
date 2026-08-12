<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCardContext } from '@/features/cards/composables/useCardContext';
import { useLabels } from '../composables/useLabels';
import { CardService } from '@/features/cards/services/card.service';
import { ToastService } from '@/shared/services/ToastService';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { TagIcon, CheckIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { LabelTheme } from '../theme/LabelTheme';

const { currentCard, boardId } = useCardContext();
const { boardLabels, loadBoardLabels, createLabel } = useLabels();

const showCreateForm = ref(false);
const newLabelName = ref('');
const selectedColor = ref('#4f46e5'); // indigo default

const colorPalette = [
  '#4f46e5', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#6b7280', // gray
];

onMounted(async () => {
  if (boardId.value) {
    try {
      await loadBoardLabels(boardId.value);
    } catch (e) {
      console.error('Failed to load board labels:', e);
    }
  }
});

const isLabelAttached = (labelId: string): boolean => {
  if (!currentCard.value?.labels) return false;
  return currentCard.value.labels.some(l => l.id === labelId);
};

const handleToggleLabel = async (labelId: string) => {
  if (!currentCard.value) return;
  const attached = isLabelAttached(labelId);
  try {
    if (attached) {
      await CardService.detachLabel(currentCard.value.id, labelId);
      ToastService.success('Label removed.');
    } else {
      await CardService.attachLabel(currentCard.value.id, labelId);
      ToastService.success('Label attached.');
    }
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to update label.');
  }
};

const handleCreateLabel = async () => {
  if (!boardId.value || !newLabelName.value.trim()) return;
  try {
    await createLabel(boardId.value, {
      name: newLabelName.value.trim(),
      color: selectedColor.value,
    });
    newLabelName.value = '';
    showCreateForm.value = false;
    ToastService.success('Label created.');
  } catch (err: any) {
    ToastService.error(err?.message || 'Failed to create label.');
  }
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
        <TagIcon class="h-3.5 w-3.5" />
        <span>Labels</span>
      </h4>
      <button
        type="button"
        @click="showCreateForm = !showCreateForm"
        class="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-0.5 focus:outline-none"
      >
        <PlusIcon class="h-3.5 w-3.5" />
        <span>Create</span>
      </button>
    </div>

    <!-- Create Label Form Inline -->
    <div v-if="showCreateForm" class="bg-gray-50 border border-gray-200/60 p-3 rounded-xl space-y-3">
      <div class="flex flex-col space-y-1">
        <label for="new-label-name" class="text-[10px] font-bold text-gray-400 uppercase">Label Name</label>
        <input
          id="new-label-name"
          v-model="newLabelName"
          type="text"
          placeholder="Label title..."
          class="text-xs border border-gray-250 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
        />
      </div>

      <!-- Color Palette Picker -->
      <div class="space-y-1">
        <span class="text-[10px] font-bold text-gray-400 uppercase">Select Color</span>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="color in colorPalette"
            :key="color"
            type="button"
            @click="selectedColor = color"
            class="h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer"
            :style="{ backgroundColor: color }"
            :class="selectedColor === color ? 'border-black ring-1 ring-black' : 'border-transparent'"
          >
            <CheckIcon v-if="selectedColor === color" class="h-3.5 w-3.5 text-white drop-shadow-xs" />
          </button>
        </div>
      </div>

      <div class="flex items-center space-x-1.5 pt-1.5">
        <BaseButton variant="primary" size="sm" @click="handleCreateLabel" class="w-full">
          Create Label
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="showCreateForm = false">
          Cancel
        </BaseButton>
      </div>
    </div>

    <!-- Active Board Labels list to check/uncheck -->
    <div class="flex flex-col space-y-1.5 max-h-48 overflow-y-auto pr-1">
      <div
        v-for="label in boardLabels"
        :key="label.id"
        @click="handleToggleLabel(label.id)"
        class="flex items-center justify-between px-3 py-2 border rounded-xl hover:border-brand-300 transition-all cursor-pointer group bg-white/70 hover:bg-white select-none"
        :style="LabelTheme.getTheme(label.color).border"
      >
        <span
          class="inline-block h-3.5 w-3.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: label.color }"
        ></span>
        <span class="text-xs font-semibold text-gray-700 flex-1 ml-2.5 truncate">
          {{ label.name }}
        </span>
        <div class="h-5 w-5 flex items-center justify-center border border-gray-200 rounded-lg group-hover:border-brand-400 bg-white">
          <CheckIcon v-if="isLabelAttached(label.id)" class="h-3.5 w-3.5 text-brand-600 font-bold" />
        </div>
      </div>

      <div v-if="boardLabels.length === 0" class="text-center py-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
        <p class="text-[11px] text-gray-400">No board labels yet.</p>
      </div>
    </div>
  </div>
</template>
