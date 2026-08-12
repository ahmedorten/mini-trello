<script setup lang="ts">
interface Props {
  visible: boolean;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  visible: false,
  message: 'Loading...',
});
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-sm select-none"
      role="alert"
      aria-busy="true"
      aria-live="assertive"
    >
      <div class="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-4 border border-gray-100 max-w-xs w-full mx-4 transform transition-all">
        <!-- Brand Initials Container with animation -->
        <div class="relative flex items-center justify-center">
          <div class="w-16 h-16 bg-brand-600 text-white font-bold text-2xl flex items-center justify-center rounded-2xl shadow-md animate-pulse">
            MT
          </div>
          <!-- Orbiting ring spinner -->
          <div class="absolute inset-[-6px] border-2 border-brand-500/30 border-t-brand-600 rounded-2xl animate-spin"></div>
        </div>
        <div class="text-center">
          <p class="text-sm font-semibold text-gray-900">{{ message }}</p>
          <p class="text-xs text-gray-500 mt-1">Please wait a moment</p>
        </div>
      </div>
    </div>
  </Transition>
</template>
