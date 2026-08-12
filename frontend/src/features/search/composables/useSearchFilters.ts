import { watch } from 'vue';
import { useSearch } from './useSearch';
import { useFilters } from '@/features/filters/composables/useFilters';
import { SearchService } from '../services/search.service';

export function useSearchFilters() {
  const { searchQuery, debouncedQuery, results, queryState, error } = useSearch();
  const { appliedFilters, hasActiveFilters, activeChips, clearFilter, clearAll } = useFilters();
  const searchService = SearchService.getInstance();

  // Watch applied filters and re-run search automatically
  watch(
    appliedFilters,
    (newFilters) => {
      const term = debouncedQuery.value.trim();
      if (term !== '') {
        searchService.search(term, newFilters);
      }
    },
    { deep: true }
  );

  return {
    searchQuery,
    debouncedQuery,
    results,
    queryState,
    error,
    appliedFilters,
    hasActiveFilters,
    activeChips,
    clearFilter,
    clearAll,
  };
}

export default useSearchFilters;
