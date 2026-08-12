import { computed } from 'vue';
import { useToastStore, type Toast } from '../stores/toast.store';

export function useToast() {
  const store = useToastStore();

  const toasts = computed(() => store.toasts);
  const queue = computed(() => store.queue);

  const addToast = (
    message: string,
    type: Toast['type'] = 'info',
    duration = 3000
  ) => {
    store.add(message, type, duration);
  };

  const removeToast = (id: string) => {
    store.remove(id);
  };

  return {
    toasts,
    queue,
    addToast,
    removeToast,
  };
}

export default useToast;
