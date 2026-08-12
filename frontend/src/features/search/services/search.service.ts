import type { FilterModel } from '@/features/filters/types';
import type { ISearchProvider, SearchResultSet, SearchCacheEntry } from '../types';
import { useSearchStore } from '../stores/search.store';
import { BoardSearchProvider } from '../providers/BoardSearchProvider';
import { CardSearchProvider } from '../providers/CardSearchProvider';
import { SearchResultMapper } from '../mappers/SearchResultMapper';
import { SearchAnalytics } from '../analytics/SearchAnalytics';

export class SearchService {
  private static instance: SearchService | null = null;
  private providers: ISearchProvider[] = [];
  private abortController: AbortController | null = null;
  
  // In-memory cache map
  private cache = new Map<string, SearchCacheEntry>();
  private readonly MAX_CACHE_SIZE = 50;
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds

  private constructor() {
    this.registerProvider(new BoardSearchProvider());
    this.registerProvider(new CardSearchProvider());
  }

  /**
   * Singleton accessor.
   */
  public static getInstance(): SearchService {
    if (!this.instance) {
      this.instance = new SearchService();
    }
    return this.instance;
  }

  /**
   * Register a new search provider dynamically.
   */
  public registerProvider(provider: ISearchProvider): void {
    this.providers.push(provider);
  }

  /**
   * Perform a multi-entity search.
   * Leverages request cancellation, LRU caching, and error resilience.
   */
  public async search(query: string, filters?: FilterModel): Promise<void> {
    const searchStore = useSearchStore();
    const cleanQuery = query.trim();

    if (cleanQuery === '') {
      this.clear();
      return;
    }

    // Set active query in store
    searchStore.setQuery(cleanQuery);

    // Cache key serialization
    const cacheKey = JSON.stringify({ query: cleanQuery, filters });
    
    // Check cache
    if (this.checkCache(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      cached.lastAccessedAt = Date.now();
      cached.hitCount++;
      searchStore.setResults(cached.results);
      searchStore.setQueryState('Success');
      SearchAnalytics.trackCacheHit(cleanQuery);
      return;
    }

    // Cancel in-flight request
    this.cancel();
    
    // Create new abort controller
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    searchStore.setQueryState('Loading');
    searchStore.setError(null);

    const startTime = Date.now();

    try {
      // Execute all registered search providers in parallel
      const providerPromises = this.providers.map(async (provider) => {
        try {
          return await provider.search(cleanQuery, filters, signal);
        } catch (error) {
          // Graceful degradation: individual provider failures log a warning and return empty lists
          console.warn(`Search provider for entity '${provider.entityType}' failed:`, error);
          return { entityType: provider.entityType, items: [], totalCount: 0 };
        }
      });

      const responses = await Promise.all(providerPromises);

      // If aborted during parallel fetches, discard results
      if (signal.aborted) {
        return;
      }

      // Map and merge results into a unified result set
      const mergedResults = SearchResultMapper.fromProviderResults(responses, cleanQuery);
      const latency = Date.now() - startTime;

      // Update store
      searchStore.setResults(mergedResults);
      searchStore.setQueryState('Success');

      // Track telemetry
      SearchAnalytics.trackSearch(cleanQuery, mergedResults.totalCount, latency);

      // Write results to cache
      this.writeCache(cacheKey, mergedResults);

      // Add to query search history
      if (mergedResults.totalCount > 0) {
        searchStore.addToHistory(cleanQuery);
      }
    } catch (error: any) {
      if (signal.aborted) {
        // Silent return for user/request cancellation
        return;
      }

      const errorMessage = error?.message || 'An unexpected error occurred during search.';
      searchStore.setError(errorMessage);
      searchStore.setQueryState('Error');
      SearchAnalytics.trackSearchError(cleanQuery, String(error?.status || '500'));
    }
  }

  /**
   * Cancel the current in-flight search request.
   */
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Clear search results, history, and flush the cache.
   */
  public clear(): void {
    const searchStore = useSearchStore();
    this.cancel();
    this.flushCache();
    searchStore.reset();
  }

  /**
   * Flush the in-memory search results cache.
   */
  public flushCache(): void {
    this.cache.clear();
  }

  // ─── Cache Helpers ──────────────────────────────────────────────────────────

  private checkCache(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL (30s expiry)
    const isExpired = Date.now() - entry.timestamp > this.CACHE_TTL_MS;
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  private writeCache(key: string, results: SearchResultSet): void {
    // Evict least recently used if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      lastAccessedAt: Date.now(),
      hitCount: 0,
    });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTimestamp) {
        oldestTimestamp = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

export default SearchService;
