import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<'light' | 'dark' | 'system'>('system');
  const resolvedTheme = ref<'light' | 'dark'>('light');

  const setMode = (newMode: 'light' | 'dark' | 'system') => {
    mode.value = newMode;
  };

  const setResolvedTheme = (theme: 'light' | 'dark') => {
    resolvedTheme.value = theme;
  };

  const reset = () => {
    mode.value = 'system';
    resolvedTheme.value = 'light';
  };

  return {
    mode,
    resolvedTheme,
    setMode,
    setResolvedTheme,
    reset,
  };
});

export default useThemeStore;
