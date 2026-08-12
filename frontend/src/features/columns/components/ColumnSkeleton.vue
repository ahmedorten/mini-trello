<script setup lang="ts">
import BaseSkeleton from '@/shared/components/base/BaseSkeleton.vue';

interface Props {
  count?: number;
}

withDefaults(defineProps<Props>(), {
  count: 4,
});
</script>

<template>
  <div class="flex space-x-6 overflow-x-auto pb-4 h-full">
    <div
      v-for="i in count"
      :key="i"
      class="flex flex-col flex-shrink-0 w-72 h-[450px] bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-4"
    >
      <div class="flex items-center justify-between">
        <BaseSkeleton class="h-5 w-1/2 rounded-md" />
        <BaseSkeleton class="h-5 w-6 rounded-md" />
      </div>
      <div class="flex-1 space-y-3 pt-2">
        <BaseSkeleton class="h-16 w-full rounded-xl" />
        <BaseSkeleton class="h-20 w-full rounded-xl" />
        <BaseSkeleton class="h-14 w-full rounded-xl" />
      </div>
    </div>
  </div>
</template>
