<script setup lang="ts">
import BaseSpinner from '../base/BaseSpinner.vue';

defineProps<{
  loading: boolean;
  message?: string;
}>();
</script>

<template>
  <div class="relative w-full h-full">
    <!-- Slot Content -->
    <slot />

    <!-- Overlay Loader -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50/70 dark:bg-gray-900/60 backdrop-blur-[2px] rounded-xl select-none"
        role="alert"
        aria-busy="true"
      >
        <div class="flex flex-col items-center space-y-2.5 p-4 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700">
          <BaseSpinner size="md" class="text-brand-600 dark:text-brand-400" />
          <p v-if="message" class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ message }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
