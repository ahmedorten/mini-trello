<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/shared/composables/useTheme';
import { ThemeService } from '@/shared/services/ThemeService';
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from '@heroicons/vue/24/outline';

// Optional prop: compact pill mode (used inside ProfileMenu)
withDefaults(
  defineProps<{ pill?: boolean }>(),
  { pill: false }
);

const { mode } = useTheme();

const cycleMode = () => {
  const next: Record<string, 'light' | 'dark' | 'system'> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };
  ThemeService.setMode(next[mode.value] ?? 'light');
};

const icon = computed(() => {
  if (mode.value === 'dark')   return MoonIcon;
  if (mode.value === 'system') return ComputerDesktopIcon;
  return SunIcon;
});

const label = computed(() => {
  if (mode.value === 'dark')   return 'Dark mode';
  if (mode.value === 'system') return 'System theme';
  return 'Light mode';
});
</script>

<template>
  <button
    type="button"
    @click="cycleMode"
    :title="label"
    :aria-label="label"
    :role="pill ? 'menuitem' : undefined"
    class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150 focus-visible:focus-ring"
    :class="pill ? 'h-7 w-7' : 'h-9 w-9'"
  >

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-75 rotate-12"
      enter-to-class="opacity-100 scale-100 rotate-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100 rotate-0"
      leave-to-class="opacity-0 scale-75 -rotate-12"
      mode="out-in"
    >
      <component
        :is="icon"
        :key="mode"
        class="h-4 w-4"
        aria-hidden="true"
      />
    </Transition>
  </button>
</template>
