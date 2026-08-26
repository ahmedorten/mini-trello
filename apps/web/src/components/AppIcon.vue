<script setup lang="ts">
import { computed } from 'vue';
import { useLocaleStore } from '@/stores/locale';
import { ICON_PATHS, type IconName } from './icons';

const props = defineProps<{
  name: IconName;
  size?: number;
  label?: string;
}>();

const locale = useLocaleStore();

const resolvedName = computed<IconName>(() => {
  if (!locale.isRtl) {
    return props.name;
  }

  if (props.name === 'chevron-start') {
    return 'chevron-end';
  }

  if (props.name === 'chevron-end') {
    return 'chevron-start';
  }

  return props.name;
});

const pathData = computed(() => ICON_PATHS[resolvedName.value]);
const dimension = computed(() => props.size ?? 24);
</script>

<template>
  <svg
    :width="dimension"
    :height="dimension"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="label ? undefined : 'true'"
    :focusable="label ? undefined : 'false'"
    :role="label ? 'img' : undefined"
    :aria-label="label"
  >
    <path :d="pathData" />
  </svg>
</template>
