<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';
import type { RouteLocationRaw } from 'vue-router';

const props = withDefaults(
  defineProps<{
    labelKey: string;
    value: number;
    icon?: IconName;
    tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'error' | 'info';
    to?: RouteLocationRaw;
  }>(),
  { icon: undefined, tone: 'neutral', to: undefined },
);

const { t, n } = useI18n();

const tag = computed(() => (props.to ? 'router-link' : 'div'));
const label = computed(() => t(props.labelKey));
const formattedValue = computed(() => n(props.value, 'decimal'));
</script>

<template>
  <component :is="tag" :to="to" class="stat-tile" :class="`stat-tile--${tone}`">
    <AppIcon v-if="icon" :name="icon" :size="22" class="stat-tile__icon" />
    <div class="stat-tile__body">
      <p class="stat-tile__value">{{ formattedValue }}</p>
      <p class="stat-tile__label">{{ label }}</p>
    </div>
  </component>
</template>

<style scoped>
.stat-tile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: inherit;
}

.stat-tile__icon {
  color: var(--stat-tile-color, var(--color-accent));
}

.stat-tile--accent {
  --stat-tile-color: var(--color-accent);
}

.stat-tile--ok {
  --stat-tile-color: var(--color-ok);
}

.stat-tile--warn {
  --stat-tile-color: var(--color-warn);
}

.stat-tile--error {
  --stat-tile-color: var(--color-error);
}

.stat-tile--info {
  --stat-tile-color: var(--color-info);
}

.stat-tile--neutral {
  --stat-tile-color: var(--color-text-muted);
}

.stat-tile__value {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.stat-tile__label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
