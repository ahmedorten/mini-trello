<script setup lang="ts">
interface Props {
  variant?: 'board-grid' | 'card-list' | 'detail-panel' | 'comment-feed' | 'default';
  count?: number;
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  count: 1,
});
</script>

<template>
  <div class="w-full animate-pulse select-none" aria-hidden="true">
    <!-- Board Grid Skeleton -->
    <div v-if="variant === 'board-grid'" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <div
        v-for="i in count"
        :key="i"
        class="h-32 bg-gray-200 dark:bg-gray-700 rounded-3xl p-5 flex flex-col justify-between border border-gray-150 dark:border-gray-650"
      >
        <div class="h-5 bg-gray-300 dark:bg-gray-600 rounded-lg w-2/3" />
        <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded-lg w-1/3" />
      </div>
    </div>

    <!-- Card List Skeleton -->
    <div v-else-if="variant === 'card-list'" class="space-y-3">
      <div
        v-for="i in count"
        :key="i"
        class="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs space-y-3"
      >
        <div class="flex items-center space-x-1.5">
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-12" />
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-16" />
        </div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4" />
        <div class="h-3 bg-gray-150 dark:bg-gray-700 rounded-lg w-1/2" />
        <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <div class="h-3.5 bg-gray-150 dark:bg-gray-700 rounded-lg w-16" />
          <div class="h-6 bg-gray-150 dark:bg-gray-700 rounded-full w-6" />
        </div>
      </div>
    </div>

    <!-- Detail Panel Skeleton -->
    <div v-else-if="variant === 'detail-panel'" class="space-y-6">
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-3/4" />
      <div class="space-y-2">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/3" />
      </div>
      <div class="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
        <div class="space-y-2">
          <div class="h-3.5 bg-gray-150 dark:bg-gray-750 rounded-lg w-1/3" />
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
        </div>
        <div class="space-y-2">
          <div class="h-3.5 bg-gray-150 dark:bg-gray-750 rounded-lg w-1/3" />
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
        </div>
      </div>
    </div>

    <!-- Comment Feed Skeleton -->
    <div v-else-if="variant === 'comment-feed'" class="space-y-4">
      <div v-for="i in count" :key="i" class="flex space-x-3">
        <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
        <div class="flex-1 space-y-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl">
          <div class="flex items-center justify-between">
            <div class="h-3.5 bg-gray-300 dark:bg-gray-600 rounded-lg w-20" />
            <div class="h-3 bg-gray-250 dark:bg-gray-650 rounded-lg w-12" />
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
        </div>
      </div>
    </div>

    <!-- Default Generic Lines -->
    <div v-else class="space-y-2.5">
      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
      <div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
      <div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
    </div>
  </div>
</template>
