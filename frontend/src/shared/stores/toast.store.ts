import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  timestamp: number;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  const queue = ref<Toast[]>([]);
  const MAX_VISIBLE = 5;
  const DUPLICATE_COOLDOWN_MS = 2000;

  const add = (message: string, type: Toast['type'] = 'info', duration = 3000) => {
    const timestamp = Date.now();

    // Check active toasts for duplicates within cooldown period
    const existingActive = toasts.value.find(
      (t) => t.message === message && t.type === type && (timestamp - t.timestamp) < DUPLICATE_COOLDOWN_MS
    );
    if (existingActive) {
      existingActive.timestamp = timestamp; // Reset timer
      // Trigger a structural update to alert components (like changing id slightly or updating store reference)
      toasts.value = [...toasts.value];
      return;
    }

    // Check queue for duplicates
    const existingQueued = queue.value.find(
      (t) => t.message === message && t.type === type && (timestamp - t.timestamp) < DUPLICATE_COOLDOWN_MS
    );
    if (existingQueued) {
      existingQueued.timestamp = timestamp;
      return;
    }

    const toastItem: Toast = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      duration,
      timestamp,
    };

    if (toasts.value.length < MAX_VISIBLE) {
      toasts.value.push(toastItem);
    } else {
      queue.value.push(toastItem);
    }
  };

  const remove = (id: string) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
    processQueue();
  };

  const processQueue = () => {
    if (toasts.value.length < MAX_VISIBLE && queue.value.length > 0) {
      const nextToast = queue.value.shift();
      if (nextToast) {
        nextToast.timestamp = Date.now(); // reset timer start time
        toasts.value.push(nextToast);
      }
    }
  };

  const reset = () => {
    toasts.value = [];
    queue.value = [];
  };

  return {
    toasts,
    queue,
    add,
    remove,
    reset,
  };
});

export default useToastStore;
