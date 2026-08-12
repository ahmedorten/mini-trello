import { computed } from 'vue';
import { useThemeStore } from '../stores/theme.store';

export function useTheme() {
  const store = useThemeStore();

  const mode = computed(() => store.mode);
  const resolvedTheme = computed(() => store.resolvedTheme);
  const isDark = computed(() => store.resolvedTheme === 'dark');

  const setMode = (newMode: 'light' | 'dark' | 'system') => {
    store.setMode(newMode);
  };

  return {
    mode,
    resolvedTheme,
    isDark,
    setMode,
  };
}

export default useTheme;
