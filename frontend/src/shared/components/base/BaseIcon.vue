<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/shared/composables/useI18n';
import * as Icons from '@heroicons/vue/24/outline';

const props = withDefaults(defineProps<{
  name: string; // e.g. "plus", "trash", "calendar", etc.
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  flipRtl?: boolean;
}>(), {
  size: 'md',
  flipRtl: false,
});

const { dir } = useI18n();

// Dynamically resolve icon component from Heroicons outline registry
const iconComponent = computed(() => {
  // Convert kebab-case names to PascalCase + Icon suffix (e.g. "chat-bubble" -> "ChatBubbleIcon")
  const cleanName = props.name.trim();
  const pascalName = cleanName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
    
  const iconName = `${pascalName}Icon`;
  return (Icons as any)[iconName] || Icons.QuestionMarkCircleIcon;
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs': return 'h-3.5 w-3.5';
    case 'sm': return 'h-4 w-4';
    case 'md': return 'h-5 w-5';
    case 'lg': return 'h-6 w-6';
    case 'xl': return 'h-8 w-8';
    default: return 'h-5 w-5';
  }
});

const shouldRotate = computed(() => {
  return props.flipRtl && dir.value === 'rtl';
});
</script>

<template>
  <component
    :is="iconComponent"
    :class="[
      sizeClasses,
      'inline-block shrink-0 transition-transform duration-200',
      shouldRotate ? 'transform rotate-180' : ''
    ]"
    aria-hidden="true"
  />
</template>
