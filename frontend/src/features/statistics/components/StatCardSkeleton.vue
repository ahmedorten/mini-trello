<script setup lang="ts">
import BaseSkeleton from '@/shared/components/base/BaseSkeleton.vue';
</script>

<template>
  <div class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-4" aria-hidden="true">
    <BaseSkeleton variant="avatar" class="h-12 w-12 flex-shrink-0" />
    <div class="flex-1 space-y-1.5">
      <BaseSkeleton class="h-3 w-1/3 rounded" />
      <BaseSkeleton class="h-6 w-1/2 rounded" />
    </div>
  </div>
</template>
