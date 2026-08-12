import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToastStore } from '../src/shared/stores/toast.store';
import { ToastService } from '../src/shared/services/ToastService';

describe('Toast Service & Store Unit Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should add a success toast notification', () => {
    ToastService.success('Card created successfully.');
    const store = useToastStore();

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe('Card created successfully.');
    expect(store.toasts[0].type).toBe('success');
  });

  it('should add an error toast notification', () => {
    ToastService.error('Failed to move card.');
    const store = useToastStore();

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe('Failed to move card.');
    expect(store.toasts[0].type).toBe('error');
  });

  it('should remove a toast notification by id', () => {
    ToastService.info('Temporary message');
    const store = useToastStore();

    const toastId = store.toasts[0].id;
    store.remove(toastId);

    expect(store.toasts).toHaveLength(0);
  });
});
