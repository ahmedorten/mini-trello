<script setup lang="ts">
import BaseSkeleton from '@/shared/components/base/BaseSkeleton.vue';
</script>

<template>
  <div class="space-y-8 w-full" aria-hidden="true">
    <!-- Stats Cards Row Skeleton -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="i in 4" :key="i" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-4">
        <BaseSkeleton variant="avatar" class="h-12 w-12 flex-shrink-0" />
        <div class="flex-1 space-y-1.5">
          <BaseSkeleton class="h-3 w-1/3 rounded" />
          <BaseSkeleton class="h-6 w-1/2 rounded" />
        </div>
      </div>
    </div>

    <!-- Due Dates Row Skeleton -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="i in 4" :key="i" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex items-center space-x-4">
        <BaseSkeleton variant="avatar" class="h-12 w-12 flex-shrink-0" />
        <div class="flex-1 space-y-1.5">
          <BaseSkeleton class="h-3 w-1/3 rounded" />
          <BaseSkeleton class="h-6 w-1/2 rounded" />
        </div>
      </div>
    </div>

    <!-- Main Grid Widgets Skeleton -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Priority Breakdown (Col 1) -->
      <div class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4">
        <BaseSkeleton class="h-4 w-32 rounded" />
        <div class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-8 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      <!-- Checklist Progress (Col 2-3) -->
      <div class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4 lg:col-span-2">
        <BaseSkeleton class="h-4 w-32 rounded" />
        <div class="space-y-3">
          <div class="h-6 w-1/4 bg-gray-100 rounded" />
          <div class="h-2 w-full bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  </div>
  <span class="sr-only">Loading dashboard statistics...</span>
</template>
