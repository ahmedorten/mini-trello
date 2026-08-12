import { computed } from 'vue';
import { useDialogStore } from '../stores/dialog.store';

export function useDialog() {
  const store = useDialogStore();

  const activeDialog = computed(() => store.activeDialog);
  const isAnyFormDirty = computed(() => store.isAnyFormDirty);
  const dialogStack = computed(() => store.dialogStack);

  const resolveActive = (result: boolean) => {
    store.resolveActive(result);
  };

  const registerDirtyForm = (id: string) => {
    store.registerDirtyForm(id);
  };

  const unregisterDirtyForm = (id: string) => {
    store.unregisterDirtyForm(id);
  };

  return {
    activeDialog,
    isAnyFormDirty,
    dialogStack,
    resolveActive,
    registerDirtyForm,
    unregisterDirtyForm,
  };
}

export default useDialog;
