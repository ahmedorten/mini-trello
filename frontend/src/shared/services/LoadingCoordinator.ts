import { watch } from 'vue';
import { useLoadingStore } from '../stores/loading.store';

export class LoadingCoordinator {
  private static DEBOUNCE_DELAY_MS = 200;
  private static MIN_VISIBLE_MS = 300;

  private static showTimer: ReturnType<typeof setTimeout> | null = null;
  private static minVisibleTimer: ReturnType<typeof setTimeout> | null = null;
  private static spinnerShownAt: number | null = null;
  private static initialized = false;

  /**
   * Initializes reactive synchronization and anti-flicker delay timers.
   */
  public static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const store = useLoadingStore();

    watch(
      () => store.activeRequests,
      (count) => {
        if (count > 0) {
          this.handleRequestsStarted(store);
        } else {
          this.handleRequestsFinished(store);
        }
      },
      { immediate: true }
    );
  }

  private static handleRequestsStarted(store: ReturnType<typeof useLoadingStore>): void {
    // If we have a pending minVisibleTimer from a previous load, cancel it
    if (this.minVisibleTimer) {
      clearTimeout(this.minVisibleTimer);
      this.minVisibleTimer = null;
    }

    // Debounce showing the loader (prevent quick flickers)
    if (!store.globalLoading && !this.showTimer) {
      this.showTimer = setTimeout(() => {
        store.setGlobalLoading(true);
        this.spinnerShownAt = Date.now();
        this.showTimer = null;
      }, this.DEBOUNCE_DELAY_MS);
    }
  }

  private static handleRequestsFinished(store: ReturnType<typeof useLoadingStore>): void {
    // Cancel the showTimer if requests finished before 200ms passed
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    if (store.globalLoading) {
      const now = Date.now();
      const elapsed = now - (this.spinnerShownAt || now);
      const remaining = Math.max(0, this.MIN_VISIBLE_MS - elapsed);

      // Keep visible for at least MIN_VISIBLE_MS to avoid short flicker
      this.minVisibleTimer = setTimeout(() => {
        store.setGlobalLoading(false);
        this.spinnerShownAt = null;
        this.minVisibleTimer = null;
      }, remaining);
    }
  }

  /**
   * Manually forces a full global loader visibility flag with a description.
   */
  public static forceLoading(isLoading: boolean): void {
    const store = useLoadingStore();
    if (isLoading) {
      store.setGlobalLoading(true);
      this.spinnerShownAt = Date.now();
    } else {
      store.setGlobalLoading(false);
      this.spinnerShownAt = null;
    }
  }

  /**
   * Resets all timers and flags.
   */
  public static shutdown(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.minVisibleTimer) clearTimeout(this.minVisibleTimer);
    this.showTimer = null;
    this.minVisibleTimer = null;
    this.spinnerShownAt = null;
    this.initialized = false;
  }
}

export default LoadingCoordinator;
