<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TicketPriority, TicketStatus } from '@/api/tickets';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'error' | 'info';

const props = withDefaults(
  defineProps<{
    tone?: Tone;
    status?: TicketStatus;
    priority?: TicketPriority;
  }>(),
  { tone: 'neutral', status: undefined, priority: undefined },
);

const { t } = useI18n();

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: 'var(--color-text-muted)', bg: 'var(--color-surface-sunken)' },
  accent: { fg: 'var(--color-accent)', bg: 'var(--color-accent-soft)' },
  ok: { fg: 'var(--color-ok)', bg: 'var(--color-ok-soft)' },
  warn: { fg: 'var(--color-warn)', bg: 'var(--color-warn-soft)' },
  error: { fg: 'var(--color-error)', bg: 'var(--color-error-soft)' },
  info: { fg: 'var(--color-info)', bg: 'var(--color-info-soft)' },
};

const STATUS_COLORS: Record<TicketStatus, { fg: string; bg: string }> = {
  OPEN: { fg: 'var(--color-status-open)', bg: 'var(--color-status-open-soft)' },
  IN_PROGRESS: { fg: 'var(--color-status-in-progress)', bg: 'var(--color-status-in-progress-soft)' },
  ON_HOLD: { fg: 'var(--color-status-on-hold)', bg: 'var(--color-status-on-hold-soft)' },
  RESOLVED: { fg: 'var(--color-status-resolved)', bg: 'var(--color-status-resolved-soft)' },
  CLOSED: { fg: 'var(--color-status-closed)', bg: 'var(--color-status-closed-soft)' },
};

const PRIORITY_COLORS: Record<TicketPriority, { fg: string; bg: string }> = {
  LOW: { fg: 'var(--color-priority-low)', bg: 'var(--color-priority-low-soft)' },
  MEDIUM: { fg: 'var(--color-priority-medium)', bg: 'var(--color-priority-medium-soft)' },
  HIGH: { fg: 'var(--color-priority-high)', bg: 'var(--color-priority-high-soft)' },
  URGENT: { fg: 'var(--color-priority-urgent)', bg: 'var(--color-priority-urgent-soft)' },
};

const label = computed(() => {
  if (props.status) {
    return t(`ticket.status.${props.status}`);
  }

  if (props.priority) {
    return t(`ticket.priority.${props.priority}`);
  }

  return null;
});

const colors = computed(() => {
  if (props.status) {
    return STATUS_COLORS[props.status] ?? TONE_COLORS.neutral;
  }

  if (props.priority) {
    return PRIORITY_COLORS[props.priority] ?? TONE_COLORS.neutral;
  }

  return TONE_COLORS[props.tone] ?? TONE_COLORS.neutral;
});

const cssVars = computed(() => ({
  '--app-badge-fg': colors.value.fg,
  '--app-badge-bg': colors.value.bg,
}));
</script>

<template>
  <span class="app-badge" :style="cssVars">
    <template v-if="label !== null">{{ label }}</template>
    <slot v-else />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border: 1px solid var(--app-badge-fg);
  color: var(--app-badge-fg);
  background: var(--app-badge-bg);
  white-space: nowrap;
}
</style>
