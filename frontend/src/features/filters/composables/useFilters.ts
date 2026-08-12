import { computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFilterStore } from '../stores/filter.store';
import { FilterService } from '../services/filter.service';
import { useBoardStore } from '@/features/boards/stores/board.store';
import { useLabelStore } from '@/features/labels/stores/label.store';
import type { FilterModel, ActiveFilter } from '../types';

export function useFilters() {
  const route = useRoute();
  const router = useRouter();
  const filterStore = useFilterStore();
  const boardStore = useBoardStore();
  const labelStore = useLabelStore();

  const activeFilters = computed(() => filterStore.activeFilters);
  const appliedFilters = computed(() => filterStore.appliedFilters);
  const isDirty = computed(() => filterStore.isDirty);
  const hasActiveFilters = computed(() => FilterService.hasActiveFilters(appliedFilters.value));

  // Load initial filter state from URL parameters on creation
  const initializeFromUrl = () => {
    const routeFilters = FilterService.fromRouteQuery(route.query as Record<string, any>);
    filterStore.load(routeFilters);
  };

  onMounted(() => {
    initializeFromUrl();
  });

  // Re-sync filter state on browser history back/forward navigation
  watch(
    () => route.query,
    () => {
      // Avoid triggering if route params match store to prevent redundant resets
      const currentUrlFilters = FilterService.fromRouteQuery(route.query as Record<string, any>);
      if (JSON.stringify(currentUrlFilters) !== JSON.stringify(appliedFilters.value)) {
        filterStore.load(currentUrlFilters);
      }
    },
    { deep: true }
  );

  const setFilter = <K extends keyof FilterModel>(key: K, value: FilterModel[K]) => {
    filterStore.setFilter(key, value);
  };

  const clearFilter = (key: keyof FilterModel) => {
    filterStore.clearFilter(key);
    applyFilters();
  };

  const clearAll = () => {
    filterStore.clearAll();
    applyFilters();
  };

  const applyFilters = () => {
    filterStore.apply();
    // Update route query with all filter parameters, preserving 'q'
    const filterQuery = FilterService.toRouteQuery(filterStore.appliedFilters);
    const newQuery = { ...route.query };

    // Remove old filter query parameters first
    const keysToRemove = [
      'board_id',
      'label_id',
      'priority',
      'due_before',
      'due_after',
      'is_archived',
      'has_checklist',
      'has_comments',
      'has_attachments',
    ];
    keysToRemove.forEach((k) => delete newQuery[k]);

    // Apply new filters
    Object.assign(newQuery, filterQuery);

    router.replace({ query: newQuery as any });
  };

  // Human-readable filter representation for chips
  const activeChips = computed<ActiveFilter[]>(() => {
    const board = boardStore.boards.find((b) => b.id === appliedFilters.value.boardId);
    const label = labelStore.boardLabels.find((l) => l.id === appliedFilters.value.labelId);
    return FilterService.toActiveFilters(appliedFilters.value, board?.name, label?.name);
  });

  return {
    activeFilters,
    appliedFilters,
    isDirty,
    hasActiveFilters,
    activeChips,
    setFilter,
    clearFilter,
    clearAll,
    applyFilters,
  };
}

export default useFilters;
