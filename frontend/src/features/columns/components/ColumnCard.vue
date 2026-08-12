<script setup lang="ts">
import ColumnHeader from './ColumnHeader.vue';
import type { Column } from '../types/models/Column';

interface Props {
  column: Column;
}

defineProps<Props>();
defineEmits<{
  (e: 'delete'): void;
}>();
</script>

<template>
  <section
    class="flex flex-col flex-shrink-0 w-72 max-h-full bg-gray-100/90 rounded-2xl border border-gray-200/60 shadow-xs group/column scroll-mt-4 column-card"
    :aria-label="column.name"
  >

    <!-- Column Header controls -->
    <ColumnHeader
      :column="column"
      @delete="$emit('delete')"
    />

    <!-- Cards Scroll Canvas Area (Holds card list components in Task-204) -->
    <div
      class="flex-1 overflow-y-auto px-3 pb-3 space-y-2 mt-1 min-h-[150px]"
      role="region"
      aria-label="Cards List"
    >
      <slot />
    </div>

    <!-- Column Footer - Trigger add cards (in TASK-204) -->
    <div class="px-3 pb-3 pt-1 border-t border-gray-200/20 select-none">
      <slot name="footer" />
    </div>
  </section>
</template>
