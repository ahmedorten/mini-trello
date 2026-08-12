<script setup lang="ts">
import { computed } from 'vue';
import type { DashboardOverview } from '../types';
import StatCard from './StatCard.vue';
import {
  FolderIcon,
  FolderOpenIcon,
  ArchiveBoxIcon,
  CircleStackIcon,
} from '@heroicons/vue/24/outline';
import { StatisticsPresenter } from '../presenters/StatisticsPresenter';

const props = defineProps<{
  data: DashboardOverview | null;
  loading?: boolean;
}>();

const boardsLabel = computed(() => StatisticsPresenter.getKpiLabel('totalBoards'));
const columnsLabel = computed(() => StatisticsPresenter.getKpiLabel('totalColumns'));
const activeCardsLabel = computed(() => StatisticsPresenter.getKpiLabel('activeCards'));
const archivedCardsLabel = computed(() => StatisticsPresenter.getKpiLabel('archivedCards'));
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full select-none">
    <!-- Boards -->
    <StatCard
      :label="boardsLabel"
      :value="data?.totalBoards ?? 0"
      color="bg-brand-50 text-brand-600"
      :loading="loading"
    >
      <template #icon>
        <FolderIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Columns -->
    <StatCard
      :label="columnsLabel"
      :value="data?.totalColumns ?? 0"
      color="bg-indigo-50 text-indigo-600"
      :loading="loading"
    >
      <template #icon>
        <CircleStackIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Active Cards -->
    <StatCard
      :label="activeCardsLabel"
      :value="data?.activeCards ?? 0"
      color="bg-emerald-50 text-emerald-600"
      :loading="loading"
    >
      <template #icon>
        <FolderOpenIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>

    <!-- Archived Cards -->
    <StatCard
      :label="archivedCardsLabel"
      :value="data?.archivedCards ?? 0"
      color="bg-gray-100 text-gray-600"
      :loading="loading"
    >
      <template #icon>
        <ArchiveBoxIcon class="h-5.5 w-5.5" aria-hidden="true" />
      </template>
    </StatCard>
  </div>
</template>
