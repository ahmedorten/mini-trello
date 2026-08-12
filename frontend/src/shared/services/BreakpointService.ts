import { ref } from 'vue';

export class BreakpointService {
  public static isMobile = ref(false);
  public static isTablet = ref(false);
  public static isDesktop = ref(false);
  public static isLandscape = ref(true);

  private static queries = {
    mobile: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1023px)',
    desktop: '(min-width: 1024px)',
    landscape: '(orientation: landscape)',
  };

  private static listeners: Record<string, { query: MediaQueryList; handler: (e: MediaQueryListEvent) => void }> = {};

  public static initialize(): void {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;

    Object.entries(this.queries).forEach(([key, qStr]) => {
      const mql = window.matchMedia(qStr);
      
      // Initial state
      this.updateRef(key, mql.matches);

      // Handler
      const handler = (e: MediaQueryListEvent) => {
        this.updateRef(key, e.matches);
      };

      mql.addEventListener('change', handler);
      this.listeners[key] = { query: mql, handler };
    });
  }

  private static updateRef(key: string, val: boolean): void {
    if (key === 'mobile') this.isMobile.value = val;
    else if (key === 'tablet') this.isTablet.value = val;
    else if (key === 'desktop') this.isDesktop.value = val;
    else if (key === 'landscape') this.isLandscape.value = val;
  }

  public static shutdown(): void {
    Object.values(this.listeners).forEach(({ query, handler }) => {
      query.removeEventListener('change', handler);
    });
    this.listeners = {};
  }
}

// Auto-init in browser context
if (typeof window !== 'undefined') {
  BreakpointService.initialize();
}

export default BreakpointService;
