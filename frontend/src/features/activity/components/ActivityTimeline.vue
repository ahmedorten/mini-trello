<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useActivities } from '../composables/useActivities';
import BaseSpinner from '@/shared/components/base/BaseSpinner.vue';
import { QueryState } from '@/core/api/contracts/QueryState';
import {
  ClipboardDocumentIcon,
  ChatBubbleLeftEllipsisIcon,
  ListBulletIcon,
  PaperClipIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  cardId: string;
}>();

const {
  activitiesViewModels,
  queryState,
  error,
  loadActivities,
} = useActivities();

const iconMap: Record<string, any> = {
  ClipboardDocumentIcon,
  ChatBubbleLeftEllipsisIcon,
  ListBulletIcon,
  PaperClipIcon,
  UserIcon,
};

const load = async () => {
  try {
    await loadActivities(props.cardId);
  } catch (e: any) {
    console.error('Failed to load activities:', e);
  }
};

onMounted(load);
watch(() => props.cardId, load);
</script>

<template>
  <div class="space-y-4 select-none">
    <!-- Header -->
    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5 border-b border-gray-100 pb-2">
      <ClockIcon class="h-4 w-4 text-gray-400" />
      <span>Activity History</span>
    </h4>

    <div class="relative min-h-[50px]">
      <div v-if="queryState === QueryState.Loading && activitiesViewModels.length === 0" class="flex items-center justify-center py-4">
        <BaseSpinner size="sm" message="Loading activities..." />
      </div>

      <div v-else-if="queryState === QueryState.Error && activitiesViewModels.length === 0" class="text-center py-4 text-xs text-red-600">
        {{ error }}
      </div>

      <div v-else class="space-y-4 pl-1 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="activity in activitiesViewModels"
          :key="activity.id"
          class="flex items-start space-x-3.5"
        >
          <!-- Mapped Left Icon Indicator -->
          <div class="h-7 w-7 rounded-lg bg-gray-50 border border-gray-150 flex items-center justify-center flex-shrink-0 mt-0.5">
            <component
              :is="iconMap[activity.iconName] || UserIcon"
              class="h-3.5 w-3.5 text-gray-500"
            />
          </div>

          <!-- Description Block -->
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-700 font-medium">
              <span class="font-bold text-gray-900 mr-1">{{ activity.creatorName }}</span>
              <span>{{ activity.actionText }}</span>
            </p>
            <p class="text-[10px] text-gray-400 font-semibold mt-0.5">
              {{ activity.relativeTime }}
            </p>
          </div>
        </div>

        <div v-if="activitiesViewModels.length === 0" class="text-center py-6 border border-dashed border-gray-150 rounded-xl bg-gray-50/50">
          <p class="text-[11px] text-gray-400">No activity logged yet.</p>
        </div>
      </div>
    </div>
  </div>
</template>
