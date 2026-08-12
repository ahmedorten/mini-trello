<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { Toast } from '../../stores/toast.store';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  toast: Toast;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const timeLeft = ref(props.toast.duration);
const paused = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;

const startTimer = () => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    if (!paused.value) {
      timeLeft.value = Math.max(0, timeLeft.value - 100);
      if (timeLeft.value <= 0) {
        emit('close');
      }
    }
  }, 100);
};

const stopTimer = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

// Reset timer if the timestamp is updated (duplicate check timer reset)
watch(
  () => props.toast.timestamp,
  () => {
    timeLeft.value = props.toast.duration;
  }
);

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  stopTimer();
});
</script>

<template>
  <div
    class="flex flex-col w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-xl pointer-events-auto overflow-hidden transition-all ring-1 ring-black/5"
    :class="[
      toast.type === 'success' && 'border-l-4 border-l-green-500',
      toast.type === 'error' && 'border-l-4 border-l-red-500',
      toast.type === 'warning' && 'border-l-4 border-l-amber-500',
      toast.type === 'info' && 'border-l-4 border-l-brand-500',
    ]"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start p-4">
      <!-- Toast Icon -->
      <div class="flex-shrink-0">
        <CheckCircleIcon v-if="toast.type === 'success'" class="h-5 w-5 text-green-500 animate-bounce" aria-hidden="true" />
        <ExclamationCircleIcon v-else-if="toast.type === 'error'" class="h-5 w-5 text-red-500 animate-bounce" aria-hidden="true" />
        <ExclamationCircleIcon v-else-if="toast.type === 'warning'" class="h-5 w-5 text-amber-500 animate-bounce" aria-hidden="true" />
        <InformationCircleIcon v-else class="h-5 w-5 text-brand-500 animate-bounce" aria-hidden="true" />
      </div>

      <!-- Message Body -->
      <div class="ml-3 flex-1 pt-0.5">
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 select-none">
          {{
            toast.type === 'success'
              ? 'Success'
              : toast.type === 'error'
              ? 'Error'
              : toast.type === 'warning'
              ? 'Warning'
              : 'Notification'
          }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 select-none font-medium leading-relaxed">
          {{ toast.message }}
        </p>
      </div>

      <!-- Close Button -->
      <div class="ml-4 flex-shrink-0 flex">
        <button
          type="button"
          @click="emit('close')"
          class="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
          aria-label="Close notification"
        >
          <XMarkIcon class="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Active Timer Progress Bar -->
    <div class="h-1 bg-gray-100 dark:bg-gray-700 w-full overflow-hidden">
      <div
        class="h-full transition-all duration-100 ease-linear"
        :class="[
          toast.type === 'success' && 'bg-green-500',
          toast.type === 'error' && 'bg-red-500',
          toast.type === 'warning' && 'bg-amber-500',
          toast.type === 'info' && 'bg-brand-500',
        ]"
        :style="{ width: `${(timeLeft / toast.duration) * 100}%` }"
      />
    </div>
  </div>
</template>
