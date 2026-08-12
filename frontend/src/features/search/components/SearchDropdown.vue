<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSearch } from '../composables/useSearch';
import { useSearchHistory } from '../composables/useSearchHistory';
import { SearchSuggestionService } from '../services/SearchSuggestionService';
import SearchSkeleton from './SearchSkeleton.vue';
import SearchEmptyState from './SearchEmptyState.vue';
import SearchErrorState from './SearchErrorState.vue';
import SearchResultGroup from './SearchResultGroup.vue';
import { ClockIcon, SparklesIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { searchQuery, results, queryState, error } = useSearch();
const { history, clearHistory } = useSearchHistory();

const suggestions = ref<string[]>([]);

// Fetch autocomplete suggestions asynchronously on query input
watch(searchQuery, async (newVal) => {
  if (newVal.trim() !== '') {
    suggestions.value = await SearchSuggestionService.getSuggestions(newVal);
  } else {
    suggestions.value = [];
  }
});

const selectTerm = (term: string) => {
  searchQuery.value = term;
};
</script>

<template>
  <div
    v-if="isOpen"
    class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-150 shadow-lg overflow-hidden z-50 flex flex-col max-h-[480px]"
    id="search-listbox"
    role="listbox"
    aria-label="Search results suggestions"
  >
    <!-- Scrollable results panel -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Search Skeletons -->
      <SearchSkeleton v-if="queryState === 'Loading'" />

      <!-- Error State -->
      <SearchErrorState v-else-if="queryState === 'Error'" :error="error" @retry="selectTerm(searchQuery)" />

      <!-- Empty State -->
      <SearchEmptyState v-else-if="queryState === 'Success' && (!results || results.totalCount === 0)" :query="searchQuery" @select-term="selectTerm" />

      <!-- Results groups -->
      <div v-else-if="queryState === 'Success' && results && results.totalCount > 0" class="space-y-4">
        <SearchResultGroup
          v-for="group in results.groups"
          :key="group.entityType"
          :group="group"
          :query="searchQuery"
          @click-item="emit('close')"
        />
      </div>

      <!-- Idle Panel (History + Autocomplete suggestion lists) -->
      <div v-else-if="queryState === 'Idle'" class="space-y-4">
        <!-- Autocomplete suggestions -->
        <div v-if="suggestions.length > 0" class="space-y-2">
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 flex items-center space-x-1.5">
            <SparklesIcon class="h-3.5 w-3.5" />
            <span>Suggestions</span>
          </h3>
          <div class="space-y-1">
            <button
              v-for="sg in suggestions"
              :key="sg"
              type="button"
              @click="selectTerm(sg)"
              class="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 rounded-xl flex items-center space-x-2 text-gray-700 transition-colors"
            >
              <span>{{ sg }}</span>
            </button>
          </div>
        </div>

        <!-- Recent Search History -->
        <div v-if="history.length > 0" class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
              <ClockIcon class="h-3.5 w-3.5" />
              <span>Recent Searches</span>
            </h3>
            <button
              type="button"
              @click="clearHistory"
              class="text-[9px] font-bold text-gray-400 hover:text-brand-600 uppercase tracking-wider focus:outline-none"
            >
              Clear
            </button>
          </div>
          <div class="space-y-1">
            <button
              v-for="term in history"
              :key="term"
              type="button"
              @click="selectTerm(term)"
              class="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 rounded-xl flex items-center space-x-2 text-gray-600 transition-colors"
            >
              <span>{{ term }}</span>
            </button>
          </div>
        </div>

        <!-- Default instruction if nothing loaded -->
        <div v-if="history.length === 0 && suggestions.length === 0" class="text-center py-6 text-gray-400 text-xs leading-relaxed">
          Type to search boards, cards, and checklist items.
        </div>
      </div>
    </div>
  </div>
</template>
