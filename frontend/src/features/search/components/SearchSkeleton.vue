<script setup lang="ts">
import BaseSkeleton from '@/shared/components/base/BaseSkeleton.vue';
</script>

<template>
  <div class="space-y-4" aria-hidden="true">
    <div class="space-y-2">
      <!-- Section Heading Skeleton -->
      <BaseSkeleton class="h-4 w-24 rounded" />
      
      <!-- Group Skeletons -->
      <div class="space-y-3">
        <div v-for="i in 3" :key="i" class="flex items-center space-x-3 p-3 bg-white border border-gray-150 rounded-xl">
          <BaseSkeleton variant="avatar" class="h-6 w-6" />
          <div class="flex-1 space-y-1.5">
            <BaseSkeleton class="h-3 w-1/3 rounded" />
            <BaseSkeleton class="h-2 w-1/4 rounded" />
          </div>
        </div>
      </div>
    </div>
  </div>
  <span class="sr-only">Searching, please wait...</span>
</template>
