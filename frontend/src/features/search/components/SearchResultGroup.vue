<script setup lang="ts">
import type { SearchProviderResult } from '../types';
import SearchResultItem from './SearchResultItem.vue';

defineProps<{
  group: SearchProviderResult;
  query: string;
}>();

const emit = defineEmits<{
  (e: 'click-item'): void;
}>();

const entityTitle = (type: string) => {
  switch (type) {
    case 'board':
      return 'Boards';
    case 'card':
      return 'Cards';
    default:
      return type;
  }
};
</script>

<template>
  <div role="group" :aria-label="entityTitle(group.entityType)" class="space-y-2 select-none">
    <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
      {{ entityTitle(group.entityType) }} ({{ group.totalCount }})
    </h3>
    <div class="space-y-1.5">
      <SearchResultItem
        v-for="item in group.items"
        :key="item.id"
        :item="item"
        :query="query"
        @click-item="emit('click-item')"
      />
    </div>
  </div>
</template>
