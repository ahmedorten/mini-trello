<script setup lang="ts">
import { watch } from 'vue';

interface Props {
  show: boolean;
  title?: string;
  align?: 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  align: 'right',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);
</script>

<template>
  <teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 bg-gray-500/75 transition-opacity">
      <div class="fixed inset-y-0 flex max-w-full" :class="[align === 'right' ? 'right-0 pl-10' : 'left-0 pr-10']">
        <div class="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900">{{ title || 'Drawer' }}</h3>
            <button @click="emit('close')" type="button" class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none">
              <span class="sr-only">Close</span>
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
