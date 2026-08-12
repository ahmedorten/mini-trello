import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FilterModel } from '../types';

const defaultFilters = (): FilterModel => ({
  boardId: undefined,
  labelId: undefined,
  priority: undefined,
  dueBefore: undefined,
  dueAfter: undefined,
  isArchived: undefined,
  hasChecklist: undefined,
  hasComments: undefined,
  hasAttachments: undefined,
  assigneeId: undefined,
});

export const useFilterStore = defineStore('filter', () => {
  const activeFilters = ref<FilterModel>(defaultFilters());
  const appliedFilters = ref<FilterModel>(defaultFilters());

  // Dirty state: active filters differ from committed applied filters
  const isDirty = computed(() => {
    return JSON.stringify(activeFilters.value) !== JSON.stringify(appliedFilters.value);
  });

  const setFilter = <K extends keyof FilterModel>(key: K, value: FilterModel[K]) => {
    activeFilters.value[key] = value;
  };

  const clearFilter = (key: keyof FilterModel) => {
    activeFilters.value[key] = undefined;
    appliedFilters.value[key] = undefined;
  };

  const clearAll = () => {
    activeFilters.value = defaultFilters();
    appliedFilters.value = defaultFilters();
  };

  const apply = () => {
    appliedFilters.value = { ...activeFilters.value };
  };

  const load = (filters: FilterModel) => {
    // Restore filter state completely
    activeFilters.value = { ...defaultFilters(), ...filters };
    appliedFilters.value = { ...defaultFilters(), ...filters };
  };

  const reset = () => {
    clearAll();
  };

  return {
    activeFilters,
    appliedFilters,
    isDirty,
    setFilter,
    clearFilter,
    clearAll,
    apply,
    load,
    reset,
  };
});

export default useFilterStore;
