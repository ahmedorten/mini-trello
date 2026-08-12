<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import BaseButton from '../base/BaseButton.vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err;
  console.error('[ErrorBoundaryCaptured]', err);
  return false; // prevent error propagation
});

const handleReload = () => {
  window.location.reload();
};

const handleReset = () => {
  error.value = null;
};
</script>

<template>
  <div v-if="error" class="min-h-[400px] flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 transition-colors">
    <div class="max-w-md w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-3xl shadow-xl p-8 text-center border-gray-150 transform scale-100 transition-all">
      <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center rounded-2xl mx-auto mb-6 ring-4 ring-red-50 dark:ring-red-950/20">
        <ExclamationTriangleIcon class="w-8 h-8" />
      </div>

      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
        An unexpected application error occurred. We have intercepted the crash to preserve your session.
      </p>

      <div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-750 text-left mb-6 font-mono text-xs text-red-600 dark:text-red-400 overflow-x-auto max-h-32">
        {{ error.message }}
      </div>

      <div class="flex items-center justify-center space-x-4">
        <BaseButton variant="secondary" @click="handleReset" class="px-5">
          Try Again
        </BaseButton>
        <BaseButton variant="primary" @click="handleReload" class="px-5">
          Reload Page
        </BaseButton>
      </div>
    </div>
  </div>
  <slot v-else />
</template>
