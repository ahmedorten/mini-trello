<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

type Variant = 'loading' | 'empty' | 'error' | 'success' | 'warning';

const props = withDefaults(
  defineProps<{
    variant: Variant;
    message?: string;
    icon?: IconName;
  }>(),
  { message: undefined, icon: undefined },
);

const { t } = useI18n();

const DEFAULT_ICONS: Record<Variant, IconName> = {
  loading: 'clock',
  empty: 'info',
  error: 'alert-circle',
  success: 'check',
  warning: 'alert-triangle',
};

const resolvedMessage = computed(() => props.message ?? t(`common.state.${props.variant}`));
const resolvedIcon = computed(() => props.icon ?? DEFAULT_ICONS[props.variant]);

const role = computed(() => {
  if (props.variant === 'error' || props.variant === 'warning') {
    return 'alert';
  }

  if (props.variant === 'loading') {
    return 'status';
  }

  return undefined;
});

const ariaLive = computed(() => (props.variant === 'loading' ? 'polite' : undefined));
</script>

<template>
  <div class="app-state-block" :class="`app-state-block--${variant}`" :role="role" :aria-live="ariaLive">
    <AppIcon :name="resolvedIcon" :size="28" class="app-state-block__icon" />
    <p class="app-state-block__message">{{ resolvedMessage }}</p>
    <div v-if="$slots.actions" class="app-state-block__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.app-state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-5);
  text-align: center;
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
}

.app-state-block__message {
  margin: 0;
  font-size: var(--font-size-sm);
}

.app-state-block__actions {
  display: flex;
  gap: var(--space-2);
}

.app-state-block--loading .app-state-block__icon {
  color: var(--color-info);
  animation: app-state-block-pulse 1.2s ease-in-out infinite;
}

.app-state-block--empty {
  color: var(--color-text-muted);
}

.app-state-block--error {
  color: var(--color-error);
  background: var(--color-error-soft);
}

.app-state-block--warning {
  color: var(--color-warn);
  background: var(--color-warn-soft);
}

.app-state-block--success {
  color: var(--color-ok);
  background: var(--color-ok-soft);
}

@keyframes app-state-block-pulse {
  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}
</style>
