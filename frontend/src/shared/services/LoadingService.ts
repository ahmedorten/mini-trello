import { useLoadingStore } from '../stores/loading.store';

export class LoadingService {
  /**
   * Register a new pending operation.
   */
  public static start(): void {
    useLoadingStore().startRequest();
  }

  /**
   * De-register a completed operation.
   */
  public static end(): void {
    useLoadingStore().endRequest();
  }
}

export default LoadingService;
