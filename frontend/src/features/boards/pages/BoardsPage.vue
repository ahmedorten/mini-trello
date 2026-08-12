<script setup lang="ts">
import { onMounted } from 'vue';
import { useBoards } from '../composables/useBoards';
import { useModal } from '@/shared/composables/useModal';
import { QueryState } from '@/core/api/contracts/QueryState';
import { useI18n } from '@/shared/composables/useI18n';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import PageContainer from '@/shared/components/layout/PageContainer.vue';
import {
  BoardToolbar,
  BoardFilters,
  BoardGrid,
  BoardSkeleton,
  BoardEmptyState,
  BoardErrorState,
  CreateBoardModal,
} from '../components';

const {
  boards,
  queryState,
  error,
  filters,
  totalPages,
  searchInput,
  changePage,
  loadBoards,
} = useBoards();

const createModal = useModal();
const { locale } = useI18n();

onMounted(() => {
  loadBoards();
});
</script>

<template>
  <PageContainer>
    <div class="space-y-6">
      <!-- Subheader toolbar with title and button -->
      <BoardToolbar @create="createModal.openModal" />

      <!-- Search / Filters block -->
      <BoardFilters v-model="searchInput" />

      <!-- Main Dynamic Board View Area -->
      <div class="relative min-h-[300px]">
        <!-- 1. Loading Skeletons -->
        <BoardSkeleton
          v-if="queryState === QueryState.Loading"
          :count="filters.pageSize"
        />

        <!-- 2. Error Display -->
        <BoardErrorState
          v-else-if="queryState === QueryState.Error"
          :message="error || undefined"
          @retry="loadBoards"
        />

        <!-- 3. Empty State -->
        <BoardEmptyState
          v-else-if="boards.length === 0"
          @create="createModal.openModal"
        />

        <!-- 4. Main Grid Results -->
        <div v-else class="space-y-6">
          <!-- Optional fading opacity for background updates -->
          <div :class="{ 'opacity-65 pointer-events-none transition-opacity duration-200': queryState === QueryState.Refreshing }">
            <BoardGrid :boards="boards" />
          </div>

          <!-- Pagination Controls -->
          <div
            v-if="totalPages > 1"
            class="flex items-center justify-between border-t border-gray-150 dark:border-gray-800 pt-5 mt-4"
            role="navigation"
            aria-label="Pagination Navigation"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400 font-semibold select-none">
              {{ locale === 'en' ? `Page ${filters.page} of ${totalPages}` : `الصفحة ${filters.page} من ${totalPages}` }}
            </span>
            <div class="flex gap-2">
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="filters.page <= 1 || queryState === QueryState.Refreshing"
                @click="changePage(filters.page - 1)"
                aria-label="Go to previous page"
              >
                {{ locale === 'en' ? 'Previous' : 'السابق' }}
              </BaseButton>
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="filters.page >= totalPages || queryState === QueryState.Refreshing"
                @click="changePage(filters.page + 1)"
                aria-label="Go to next page"
              >
                {{ locale === 'en' ? 'Next' : 'التالي' }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Board Form Popup Modal -->
      <CreateBoardModal
        :show="createModal.isOpen.value"
        @close="createModal.closeModal"
      />
    </div>
  </PageContainer>
</template>
