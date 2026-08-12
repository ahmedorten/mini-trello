<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useStatistics } from '@/features/statistics/composables/useStatistics';
import { BoardService } from '@/features/boards/services/board.service';
import { useModal } from '@/shared/composables/useModal';
import { useI18n } from '@/shared/composables/useI18n';
import { useSession } from '@/features/auth/composables/useSession';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseIcon from '@/shared/components/base/BaseIcon.vue';
import PageContainer from '@/shared/components/layout/PageContainer.vue';
import PageHeader from '@/shared/components/layout/PageHeader.vue';
import CreateBoardModal from '@/features/boards/components/CreateBoardModal.vue';
import DashboardGrid from '@/features/statistics/components/DashboardGrid.vue';
import WidgetRegistry from '@/features/statistics/registry/WidgetRegistry';
import StatsDashboardSkeleton from '@/features/statistics/components/StatsDashboardSkeleton.vue';
import StatsEmptyState from '@/features/statistics/components/StatsEmptyState.vue';
import StatsErrorState from '@/features/statistics/components/StatsErrorState.vue';

const {
  stats,
  queryState,
  error,
  loadStatistics,
  refresh,
} = useStatistics();

const createModal = useModal();
const { t, locale } = useI18n();
const { user } = useSession();

// Load statistics and boards list in parallel on mount
onMounted(async () => {
  try {
    await Promise.all([
      loadStatistics(),
      // Fetch recent boards list for the RecentBoardsWidget
      BoardService.fetchBoards({ pageSize: 5 }),
    ]);
  } catch (e) {
    console.error('Failed to load workspace dashboard', e);
  }
});

const showSkeleton = computed(() => queryState.value === 'Loading');
const showError = computed(() => queryState.value === 'Error');
const showEmpty = computed(() => {
  return queryState.value === 'Success' && stats.value?.overview.totalBoards === 0;
});
const isRefreshing = computed(() => queryState.value === 'Refreshing');

// Dynamic Greeting based on time-of-day and user
const greeting = computed(() => {
  const hr = new Date().getHours();
  const name = user.value?.fullName || '';
  if (locale.value === 'ar') {
    if (hr < 12) return `صباح الخير، ${name} 👋`;
    if (hr < 17) return `مساء الخير، ${name} 👋`;
    return `طاب مساؤك، ${name} 👋`;
  } else {
    if (hr < 12) return `Good morning, ${name} 👋`;
    if (hr < 17) return `Good afternoon, ${name} 👋`;
    return `Good evening, ${name} 👋`;
  }
});

const welcomeSubtitle = computed(() => {
  return locale.value === 'ar'
    ? 'إليك ما يحدث في مساحة عملك اليوم.'
    : "Here's what's happening in your workspace today.";
});

const breadcrumbs = computed(() => [
  { label: locale.value === 'en' ? 'Dashboard' : 'لوحة التحكم' }
]);
</script>

<template>
  <PageContainer>
    <div class="space-y-6 select-none">
      <!-- Header Title Bar with Native Breadcrumbs -->
      <PageHeader
        :title="t('dashboard.title')"
        :subtitle="locale === 'en' ? 'Real-time statistics and summaries of your active projects.' : 'إحصائيات وملخصات فورية لمشاريعك النشطة.'"
        :breadcrumbs="breadcrumbs"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <!-- Manual Refresh Button -->
            <button
              type="button"
              @click="refresh"
              :disabled="isRefreshing || showSkeleton"
              class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-surface-raised border border-border rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs focus-visible:focus-ring"
              aria-label="Refresh dashboard statistics"
            >
              <BaseIcon
                name="arrow-path"
                size="xs"
                :class="{ 'animate-spin': isRefreshing }"
              />
              <span>{{ locale === 'en' ? 'Refresh' : 'تحديث' }}</span>
            </button>

            <BaseButton
              @click="createModal.openModal"
              class="flex items-center gap-1.5 shadow-sm active:scale-[0.97]"
              aria-label="Create a new board"
            >
              <BaseIcon name="plus" size="xs" />
              <span>{{ t('boards.createBoard') }}</span>
            </BaseButton>
          </div>
        </template>
      </PageHeader>

      <!-- Error State -->
      <StatsErrorState v-if="showError" :error="error" @retry="refresh" />

      <!-- Empty Onboarding State -->
      <StatsEmptyState v-else-if="showEmpty" @create="createModal.openModal" />

      <!-- Loading Skeleton Grid -->
      <StatsDashboardSkeleton v-else-if="showSkeleton" />

      <!-- Normal Widget Grid -->
      <div v-else class="space-y-6">
        <!-- Row 0: Personalized Welcome Strips -->
        <div class="bg-gradient-to-r from-indigo-50/60 to-brand-50/30 dark:from-indigo-950/20 dark:to-brand-900/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/50 flex flex-col justify-center text-start">
          <h2 class="text-lg font-bold text-text-base leading-none">
            {{ greeting }}
          </h2>
          <p class="text-xs text-text-muted mt-1.5 font-medium">
            {{ welcomeSubtitle }}
          </p>
        </div>

        <!-- Metric Cards and Analytics Widgets -->
        <DashboardGrid
          :widgets="WidgetRegistry"
          :stats="stats"
          :loading="isRefreshing"
        />
      </div>

      <!-- Create Board Modal -->
      <CreateBoardModal
        :show="createModal.isOpen.value"
        @close="createModal.closeModal"
      />
    </div>
  </PageContainer>
</template>
