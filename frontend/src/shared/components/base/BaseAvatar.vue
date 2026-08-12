<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const initials = computed(() => {
  if (!props.name) return '';
  const parts = props.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});
</script>

<template>
  <div class="relative inline-block select-none">
    <img
      v-if="src"
      :src="src"
      :alt="name"
      class="rounded-full object-cover"
      :class="[
        size === 'xs' && 'h-6 w-6',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
      ]"
    />
    <div
      v-else
      class="flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold"
      :class="[
        size === 'xs' && 'h-6 w-6 text-[10px]',
        size === 'sm' && 'h-8 w-8 text-xs',
        size === 'md' && 'h-10 w-10 text-sm',
        size === 'lg' && 'h-12 w-12 text-base',
      ]"
    >
      {{ initials }}
    </div>
  </div>
</template>

