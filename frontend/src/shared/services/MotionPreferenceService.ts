import { ref } from 'vue';

export class MotionPreferenceService {
  private static reducedMotionRef = ref(false);
  private static mediaQuery: MediaQueryList | null = null;

  private static handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    MotionPreferenceService.reducedMotionRef.value = e.matches;
  };

  public static initialize(): void {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.handleChange(this.mediaQuery);
      this.mediaQuery.addEventListener('change', this.handleChange);
    }
  }

  public static shutdown(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleChange);
      this.mediaQuery = null;
    }
  }

  /**
   * Returns a reactive Vue ref indicating if reduced motion is preferred by the user/OS.
   */
  public static isReducedMotion(): { value: boolean } {
    return this.reducedMotionRef;
  }
}

// Automatically initialize in browser environments
if (typeof window !== 'undefined') {
  MotionPreferenceService.initialize();
}

export default MotionPreferenceService;
