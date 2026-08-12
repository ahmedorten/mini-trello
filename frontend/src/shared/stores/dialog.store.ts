import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface DialogRequest {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  severity: 'info' | 'warning' | 'danger';
  resolve: (value: boolean) => void;
}

export const useDialogStore = defineStore('dialog', () => {
  const dialogStack = ref<DialogRequest[]>([]);
  const dirtyFormsRegistry = ref<Set<string>>(new Set());

  const activeDialog = computed<DialogRequest | null>(() => {
    return dialogStack.value[dialogStack.value.length - 1] || null;
  });

  const pushDialog = (request: Omit<DialogRequest, 'id' | 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      const newRequest: DialogRequest = {
        ...request,
        id: Math.random().toString(36).substring(2, 9),
        resolve: (val: boolean) => {
          resolve(val);
          // Auto remove from stack once resolved
          removeDialog(newRequest.id);
        },
      };
      dialogStack.value.push(newRequest);
    });
  };

  const removeDialog = (id: string) => {
    dialogStack.value = dialogStack.value.filter((d) => d.id !== id);
  };

  const resolveActive = (result: boolean) => {
    if (activeDialog.value) {
      activeDialog.value.resolve(result);
    }
  };

  // Form dirty state management
  const registerDirtyForm = (id: string) => {
    dirtyFormsRegistry.value.add(id);
  };

  const unregisterDirtyForm = (id: string) => {
    dirtyFormsRegistry.value.delete(id);
  };

  const isAnyFormDirty = computed(() => {
    return dirtyFormsRegistry.value.size > 0;
  });

  const reset = () => {
    // Resolve all active pending dialogs to false
    dialogStack.value.forEach((d) => d.resolve(false));
    dialogStack.value = [];
    dirtyFormsRegistry.value.clear();
  };

  return {
    dialogStack,
    activeDialog,
    dirtyFormsRegistry,
    isAnyFormDirty,
    pushDialog,
    resolveActive,
    registerDirtyForm,
    unregisterDirtyForm,
    reset,
  };
});

export default useDialogStore;
