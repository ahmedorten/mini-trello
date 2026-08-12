/**
 * SearchSuggestionService — Autocomplete Extension Point
 *
 * Provides search suggestion/autocomplete functionality.
 * Current implementation returns an empty array.
 *
 * Future integration options (no other file changes needed):
 * - Backend `/search/suggest` endpoint
 * - Client-side history-based suggestions from localStorage
 * - Fuzzy match against recently searched terms
 *
 * Consumed by SearchDropdown.vue to show inline hint text below the search input.
 */
export class SearchSuggestionService {
  /**
   * Retrieve autocomplete suggestions for the given query.
   * @param query - The partial search term to suggest completions for
   * @returns Promise resolving to an array of suggestion strings
   */
  public static async getSuggestions(_query: string): Promise<string[]> {
    // No-op: returns empty array until backend support is available.
    // Replace with: return apiClient.get<string[]>('/search/suggest', { params: { q: query } });
    return [];
  }
}

export default SearchSuggestionService;
