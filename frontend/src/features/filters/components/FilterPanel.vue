<script setup lang="ts">
import { useFilters } from '../composables/useFilters';
import FilterBoardSelect from './FilterBoardSelect.vue';
import FilterPrioritySelect from './FilterPrioritySelect.vue';
import FilterLabelSelect from './FilterLabelSelect.vue';
import FilterDateRange from './FilterDateRange.vue';
import FilterCompletionSelect from './FilterCompletionSelect.vue';
import BaseCheckbox from '@/shared/components/base/BaseCheckbox.vue';

const {
  activeFilters,
  isDirty,
  setFilter,
  clearAll,
  applyFilters,
} = useFilters();
</script>

<template>
  <div class="bg-white rounded-2xl border border-gray-150 shadow-xs flex flex-col h-full overflow-hidden select-none">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
      <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</h3>
      <button
        type="button"
        @click="clearAll"
        class="text-[11px] font-bold text-gray-500 hover:text-brand-600 transition-colors uppercase tracking-wider focus:outline-none"
      >
        Reset
      </button>
    </div>

    <!-- Scrollable Fields -->
    <div class="flex-1 overflow-y-auto px-5 py-6 space-y-6">
      <!-- Scope Board -->
      <FilterBoardSelect
        :model-value="activeFilters.boardId"
        @update:model-value="(val) => setFilter('boardId', val)"
      />

      <hr class="border-gray-100" />

      <!-- Priority -->
      <FilterPrioritySelect
        :model-value="activeFilters.priority"
        @update:model-value="(val) => setFilter('priority', val)"
      />

      <hr class="border-gray-100" />

      <!-- Labels -->
      <FilterLabelSelect
        :model-value="activeFilters.labelId"
        @update:model-value="(val) => setFilter('labelId', val)"
      />

      <hr class="border-gray-100" />

      <!-- Due Date -->
      <FilterDateRange
        :due-before="activeFilters.dueBefore"
        :due-after="activeFilters.dueAfter"
        @update:due-before="(val) => setFilter('dueBefore', val)"
        @update:due-after="(val) => setFilter('dueAfter', val)"
      />

      <hr class="border-gray-100" />

      <!-- Completion -->
      <FilterCompletionSelect
        :model-value="activeFilters.isArchived"
        @update:model-value="(val) => setFilter('isArchived', val)"
      />

      <hr class="border-gray-100" />

      <!-- Checkboxes -->
      <fieldset class="space-y-3">
        <legend class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Content Options</legend>
        
        <BaseCheckbox
          :model-value="activeFilters.hasChecklist === true"
          @update:model-value="(val) => setFilter('hasChecklist', val ? true : undefined)"
          label="Has Checklist"
        />

        <BaseCheckbox
          :model-value="activeFilters.hasComments === true"
          @update:model-value="(val) => setFilter('hasComments', val ? true : undefined)"
          label="Has Comments"
        />

        <BaseCheckbox
          :model-value="activeFilters.hasAttachments === true"
          @update:model-value="(val) => setFilter('hasAttachments', val ? true : undefined)"
          label="Has Attachments"
        />
      </fieldset>

      <!-- Preset Restore Placeholder (Refinement #4 stub) -->
      <div class="rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50/50">
        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Presets</span>
        <p class="text-[11px] text-gray-500">Presets can be managed in future upgrades.</p>
      </div>
    </div>

    <!-- Apply Footer -->
    <div class="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
      <button
        type="button"
        @click="applyFilters"
        class="w-full text-center py-2.5 text-xs font-bold rounded-xl text-white transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
        :class="[
          isDirty
            ? 'bg-brand-600 hover:bg-brand-700 active:scale-[0.99]'
            : 'bg-gray-300 cursor-not-allowed'
        ]"
        :disabled="!isDirty"
      >
        Apply Filters
      </button>
    </div>
  </div>
</template>
