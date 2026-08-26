<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    icon?: IconName;
    iconOnly?: boolean;
    loading?: boolean;
    disabled?: boolean;
    /** A bare <button> inside a form submits it — several retrofit sites sit
     *  inside forms, so the default must be 'button', not the HTML default. */
    type?: 'button' | 'submit';
    ariaLabel?: string;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    icon: undefined,
    iconOnly: false,
    loading: false,
    disabled: false,
    type: 'button',
    ariaLabel: undefined,
  },
);

if (import.meta.env.DEV) {
  watchEffect(() => {
    if (props.iconOnly && !props.ariaLabel) {
      console.warn('AppButton: iconOnly requires an aria-label.');
    }
  });
}

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    :type="type"
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'app-button--icon-only': iconOnly }]"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <AppIcon v-if="icon && !loading" :name="icon" :size="size === 'sm' ? 16 : 18" />
    <span v-if="!iconOnly" class="app-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius);
  border: 1px solid transparent;
  font: inherit;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-button--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
}

.app-button--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
}

.app-button--icon-only.app-button--md {
  padding: var(--space-2);
}

.app-button--icon-only.app-button--sm {
  padding: var(--space-1);
}

.app-button--primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

.app-button--secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.app-button--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--color-text);
}

.app-button--danger {
  background: var(--color-error-soft);
  border-color: var(--color-error);
  color: var(--color-error);
}

.app-button__spinner {
  inline-size: 0.9em;
  block-size: 0.9em;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-inline-end-color: transparent;
  animation: app-button-spin 0.6s linear infinite;
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
