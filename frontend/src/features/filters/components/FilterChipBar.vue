<script setup lang="ts">
import { useFilters } from '../composables/useFilters';
import FilterChip from './FilterChip.vue';

const { activeChips, clearFilter, clearAll, hasActiveFilters } = useFilters();
</script>

<template>
  <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2 select-none" aria-label="Active filters summary">
    <FilterChip
      v-for="chip in activeChips"
      :key="chip.key"
      :label="chip.label"
      :value="chip.displayValue"
      @remove="clearFilter(chip.key)"
    />

    <button
      type="button"
      @click="clearAll"
      class="text-xs font-bold text-gray-500 hover:text-brand-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all uppercase tracking-wider"
      aria-label="Clear all active filters"
    >
      Clear All
    </button>
  </div>
</template>
