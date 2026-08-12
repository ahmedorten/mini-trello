<script setup lang="ts">
import { computed } from 'vue';
import { LabelTheme } from '../theme/LabelTheme';

const props = defineProps<{
  name: string;
  color: string;
  size?: 'sm' | 'md';
}>();

const theme = computed(() => LabelTheme.getTheme(props.color));
</script>

<template>
  <span
    class="inline-flex items-center font-semibold rounded-md border"
    :class="[
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2.5 py-1 text-xs leading-none',
      theme.text
    ]"
    :style="[theme.bg, theme.border]"
  >
    {{ name }}
  </span>
</template>
