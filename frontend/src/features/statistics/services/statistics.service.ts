import { StatisticsApi } from '../api/statistics.api';
import { useStatisticsStore } from '../stores/statistics.store';

export class StatisticsService {
  /**
   * Fetch complete dashboard statistics on initial load.
   * Employs standard Loading state.
   */
  public static async fetchDashboard(): Promise<void> {
    const store = useStatisticsStore();
    
    // Guard: If we already have fresh data (e.g. within 30 seconds), skip fetch
    const now = Date.now();
    if (
      store.stats &&
      store.queryState === 'Success' &&
      store.lastRefreshedAt &&
      now - new Date(store.lastRefreshedAt).getTime() < 30_000
    ) {
      return;
    }

    store.setQueryState('Loading');
    store.setError(null);

    const result = await StatisticsApi.getDashboard();
    if (result.success) {
      store.setStats(result.data);
      store.setLastRefreshedAt(new Date().toISOString());
      store.setQueryState('Success');
    } else {
      store.setError(result.error?.message || 'Failed to load dashboard statistics.');
      store.setQueryState('Error');
    }
  }

  /**
   * Explicitly refresh dashboard statistics.
   * Employs Refreshing state (preserves existing data in store while fetching).
   */
  public static async refresh(): Promise<void> {
    const store = useStatisticsStore();

    store.setQueryState('Refreshing');
    store.setError(null);

    const result = await StatisticsApi.getDashboard();
    if (result.success) {
      store.setStats(result.data);
      store.setLastRefreshedAt(new Date().toISOString());
      store.setQueryState('Success');
    } else {
      store.setError(result.error?.message || 'Failed to refresh statistics.');
      store.setQueryState('Error');
    }
  }

  /**
   * Clear all statistical data and reset to Idle.
   */
  public static clear(): void {
    const store = useStatisticsStore();
    store.reset();
  }
}

export default StatisticsService;
