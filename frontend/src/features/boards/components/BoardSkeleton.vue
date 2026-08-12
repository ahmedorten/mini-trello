<script setup lang="ts">
import BaseSkeleton from '@/shared/components/base/BaseSkeleton.vue';

interface Props {
  count?: number;
}

withDefaults(defineProps<Props>(), {
  count: 6,
});
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
    <div
      v-for="i in count"
      :key="i"
      class="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col h-28 justify-between select-none"
    >
      <div>
        <BaseSkeleton class="h-5 w-2/3 rounded-md" />
        <BaseSkeleton class="h-3 w-5/6 rounded-md mt-3" />
        <BaseSkeleton class="h-3 w-1/2 rounded-md mt-1.5" />
      </div>
      <div class="flex items-center justify-between mt-4">
        <BaseSkeleton class="h-2.5 w-1/4 rounded-sm" />
        <BaseSkeleton class="h-2.5 w-1/3 rounded-sm" />
      </div>
    </div>
  </div>
</template>
