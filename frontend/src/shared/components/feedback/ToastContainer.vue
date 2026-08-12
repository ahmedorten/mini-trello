<script setup lang="ts">

import { useToast } from '../../composables/useToast';
import ToastItem from './ToastItem.vue';
import { AnimationPresets } from '../../animations/AnimationPresets';

const { toasts, removeToast } = useToast();

// Sub-component-like structure using composition inside the template
</script>

<template>
  <div
    class="fixed top-4 right-4 z-[9999] flex flex-col space-y-3 w-full max-w-sm pointer-events-none"
    role="region"
    aria-live="polite"
    aria-label="Notifications"
  >
    <TransitionGroup
      :enter-active-class="AnimationPresets.toast.enterActiveClass"
      :enter-from-class="AnimationPresets.toast.enterFromClass"
      :enter-to-class="AnimationPresets.toast.enterToClass"
      :leave-active-class="AnimationPresets.toast.leaveActiveClass"
      :leave-from-class="AnimationPresets.toast.leaveFromClass"
      :leave-to-class="AnimationPresets.toast.leaveToClass"
    >
      <ToastItem
        v-for="toast in toasts"
        :key="toast.id"
        :toast="toast"
        @close="removeToast(toast.id)"
      />
    </TransitionGroup>
  </div>
</template>
