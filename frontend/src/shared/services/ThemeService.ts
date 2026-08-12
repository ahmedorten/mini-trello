import { useThemeStore } from '../stores/theme.store';

export class ThemeService {
  private static STORAGE_KEY = 'mini-trello:theme';
  private static mediaQuery: MediaQueryList | null = null;

  public static initialize(): void {
    if (typeof window === 'undefined') return;

    const store = useThemeStore();
    const savedMode = localStorage.getItem(this.STORAGE_KEY) as 'light' | 'dark' | 'system' | null;
    const initialMode = savedMode || 'system';

    store.setMode(initialMode);
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Initial resolution
    this.resolveTheme();

    // Listen to OS changes
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);

    // Listen to tab storage updates for multi-tab sync
    window.addEventListener('storage', this.handleStorageUpdate);
  }

  public static shutdown(): void {
    if (typeof window === 'undefined') return;
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
      this.mediaQuery = null;
    }
    window.removeEventListener('storage', this.handleStorageUpdate);
  }

  public static setMode(mode: 'light' | 'dark' | 'system'): void {
    const store = useThemeStore();
    store.setMode(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.resolveTheme();
  }

  private static resolveTheme(): void {
    const store = useThemeStore();
    const systemIsDark = this.mediaQuery?.matches ?? false;
    let resolved: 'light' | 'dark' = 'light';

    if (store.mode === 'system') {
      resolved = systemIsDark ? 'dark' : 'light';
    } else {
      resolved = store.mode === 'dark' ? 'dark' : 'light';
    }

    store.setResolvedTheme(resolved);
    this.applyHtmlClass(resolved);
  }

  private static applyHtmlClass(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private static handleSystemThemeChange = (): void => {
    const store = useThemeStore();
    if (store.mode === 'system') {
      this.resolveTheme();
    }
  };

  private static handleStorageUpdate = (e: StorageEvent): void => {
    if (e.key === this.STORAGE_KEY && e.newValue) {
      this.setMode(e.newValue as 'light' | 'dark' | 'system');
    }
  };
}

export default ThemeService;
