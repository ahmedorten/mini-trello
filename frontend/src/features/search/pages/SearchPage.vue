<script setup lang="ts">
import { useSearchFilters } from '../composables/useSearchFilters';
import SearchBar from '../components/SearchBar.vue';
import FilterChipBar from '@/features/filters/components/FilterChipBar.vue';
import FilterPanel from '@/features/filters/components/FilterPanel.vue';
import SearchSkeleton from '../components/SearchSkeleton.vue';
import SearchEmptyState from '../components/SearchEmptyState.vue';
import SearchErrorState from '../components/SearchErrorState.vue';
import SearchResultGroup from '../components/SearchResultGroup.vue';
import PageContainer from '@/shared/components/layout/PageContainer.vue';
import SectionCard from '@/shared/components/layout/SectionCard.vue';
import { useI18n } from '@/shared/composables/useI18n';

const {
  searchQuery,
  results,
  queryState,
  error,
} = useSearchFilters();

const { t } = useI18n();

const selectTerm = (term: string) => {
  searchQuery.value = term;
};
</script>

<template>
  <PageContainer>
    <div class="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-8rem)] w-full select-none text-start">
      <!-- Main Left Area: Search Bar + Results -->
      <div class="flex-1 space-y-6 flex flex-col min-w-0">
        <!-- Search Input Toolbar -->
        <SectionCard :title="t('search.title')">
          <div class="space-y-4">
            <SearchBar />
            <FilterChipBar />
          </div>
        </SectionCard>

        <!-- Result Viewport -->
        <div class="flex-1 min-w-0">
          <!-- Search Skeletons -->
          <SearchSkeleton v-if="queryState === 'Loading'" />

          <!-- Error State -->
          <SearchErrorState
            v-else-if="queryState === 'Error'"
            :error="error"
            @retry="selectTerm(searchQuery)"
          />

          <!-- Empty State -->
          <SearchEmptyState
            v-else-if="queryState === 'Success' && (!results || results.totalCount === 0)"
            :query="searchQuery"
            @select-term="selectTerm"
          />

          <!-- Grouped Results -->
          <div
            v-else-if="queryState === 'Success' && results && results.totalCount > 0"
            class="space-y-6 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800/80 shadow-xs"
          >
            <SearchResultGroup
              v-for="group in results.groups"
              :key="group.entityType"
              :group="group"
              :query="searchQuery"
            />
          </div>

          <!-- Idle State -->
          <div
            v-else-if="queryState === 'Idle'"
            class="bg-white dark:bg-gray-900 p-10 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-xs text-center text-gray-400 dark:text-gray-500 text-sm leading-relaxed"
          >
            {{ t('search.placeholder') }}
          </div>
        </div>
      </div>

      <!-- Sidebar Right Area: Filter Controls -->
      <aside class="w-full lg:w-72 flex-shrink-0">
        <FilterPanel />
      </aside>
    </div>
  </PageContainer>
</template>
