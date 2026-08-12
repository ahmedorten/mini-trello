/**
 * SearchAnalytics — Telemetry Extension Point
 *
 * All methods are intentionally no-op stubs at this stage.
 * Future telemetry integration (Google Analytics, Mixpanel, internal event bus, etc.)
 * requires ONLY implementing these methods — no changes to SearchService or any other file.
 *
 * SearchService calls these methods after each search lifecycle event.
 */
export class SearchAnalytics {
  /**
   * Track a completed search request.
   * @param query - The search term used
   * @param resultCount - Total number of results returned
   * @param latencyMs - Request round-trip time in milliseconds
   */
  public static trackSearch(
    _query: string,
    _resultCount: number,
    _latencyMs: number
  ): void {
    // No-op: implement with your analytics provider
  }

  /**
   * Track when a user clicks on a search result.
   * @param entityType - The type of entity clicked ('board' | 'card')
   * @param entityId - The ID of the clicked entity
   * @param query - The search query that produced the result
   */
  public static trackResultClick(
    _entityType: string,
    _entityId: string,
    _query: string
  ): void {
    // No-op: implement with your analytics provider
  }

  /**
   * Track a search error (excluding user-initiated cancellations).
   * @param query - The search term that caused the error
   * @param errorCode - HTTP status code or error type string
   */
  public static trackSearchError(_query: string, _errorCode: string): void {
    // No-op: implement with your analytics provider
  }

  /**
   * Track a search result served from the in-memory cache (cache hit).
   * @param query - The search term that was served from cache
   */
  public static trackCacheHit(_query: string): void {
    // No-op: implement with your analytics provider
  }
}

export default SearchAnalytics;
