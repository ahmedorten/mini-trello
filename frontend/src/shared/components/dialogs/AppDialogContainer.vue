<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDialog } from '../../composables/useDialog';
import { FocusManager } from '../../services/FocusManager';
import { AnimationPresets } from '../../animations/AnimationPresets';
import BaseButton from '../base/BaseButton.vue';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const { activeDialog, resolveActive } = useDialog();

const dialogRef = ref<HTMLElement | null>(null);

// Keyboard focus trap implementation
const handleTabKey = (e: KeyboardEvent) => {
  if (e.key !== 'Tab' || !dialogRef.value) return;

  const focusable = dialogRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const firstEl = focusable[0] as HTMLElement;
  const lastEl = focusable[focusable.length - 1] as HTMLElement;

  if (e.shiftKey) {
    if (document.activeElement === firstEl) {
      lastEl.focus();
      e.preventDefault();
    }
  } else {
    if (document.activeElement === lastEl) {
      firstEl.focus();
      e.preventDefault();
    }
  }
};

// Watch activeDialog to manage focus stack
watch(
  () => activeDialog.value,
  async (newVal, oldVal) => {
    if (newVal) {
      FocusManager.stashFocus();
      await nextTick();
      if (dialogRef.value) {
        const focusable = dialogRef.value.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          (focusable[0] as HTMLElement).focus();
        }
      }
    } else if (oldVal && !newVal) {
      FocusManager.restoreFocus();
    }
  }
);

const handleConfirm = () => {
  resolveActive(true);
};

const handleCancel = () => {
  resolveActive(false);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!activeDialog.value) return;

  if (e.key === 'Escape') {
    handleCancel();
  } else if (e.key === 'Tab') {
    handleTabKey(e);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown);
}
</script>

<template>
  <Transition
    :enter-active-class="AnimationPresets.fade.enterActiveClass"
    :leave-active-class="AnimationPresets.fade.leaveActiveClass"
    :enter-from-class="AnimationPresets.fade.enterFromClass"
    :leave-to-class="AnimationPresets.fade.leaveToClass"
  >
    <div
      v-if="activeDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 dark:bg-gray-950/60 backdrop-blur-sm p-4 select-none"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="activeDialog.id + '-title'"
      :aria-describedby="activeDialog.id + '-desc'"
    >
      <Transition
        :enter-active-class="AnimationPresets.modal.enterActiveClass"
        :leave-active-class="AnimationPresets.modal.leaveActiveClass"
        :enter-from-class="AnimationPresets.modal.enterFromClass"
        :leave-to-class="AnimationPresets.modal.leaveToClass"
        appear
      >
        <div
          ref="dialogRef"
          class="relative w-full max-w-md bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-3xl shadow-2xl p-6 overflow-hidden transition-all text-center sm:text-left"
        >
          <!-- Header and Close -->
          <div class="absolute top-4 right-4">
            <button
              type="button"
              @click="handleCancel"
              class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Close dialog"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="sm:flex sm:items-start sm:space-x-4">
            <!-- Icon -->
            <div
              class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl sm:mx-0 sm:h-10 sm:w-10"
              :class="[
                activeDialog.severity === 'danger' && 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
                activeDialog.severity === 'warning' && 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
                activeDialog.severity === 'info' && 'bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400',
              ]"
            >
              <ExclamationTriangleIcon v-if="activeDialog.severity === 'danger' || activeDialog.severity === 'warning'" class="h-6 w-6 sm:h-5 sm:w-5" />
              <InformationCircleIcon v-else class="h-6 w-6 sm:h-5 sm:w-5" />
            </div>

            <!-- Content -->
            <div class="mt-3 sm:mt-0 sm:text-left w-full">
              <h3
                :id="activeDialog.id + '-title'"
                class="text-lg font-bold text-gray-900 dark:text-gray-100 leading-6"
              >
                {{ activeDialog.title }}
              </h3>
              <p
                :id="activeDialog.id + '-desc'"
                class="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium"
              >
                {{ activeDialog.message }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <BaseButton
              variant="secondary"
              @click="handleCancel"
              class="w-full sm:w-auto px-5 py-2"
            >
              {{ activeDialog.cancelText }}
            </BaseButton>
            <BaseButton
              :variant="activeDialog.severity === 'danger' ? 'danger' : 'primary'"
              @click="handleConfirm"
              class="w-full sm:w-auto px-5 py-2"
            >
              {{ activeDialog.confirmText }}
            </BaseButton>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
