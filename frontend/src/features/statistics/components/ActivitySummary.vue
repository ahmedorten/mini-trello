<script setup lang="ts">
import { computed } from 'vue';
import type { DashboardActivity } from '../types';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { ActivityMapper } from '@/features/activity/mappers/ActivityMapper';
import {
  ClipboardDocumentIcon,
  ChatBubbleLeftEllipsisIcon,
  ListBulletIcon,
  PaperClipIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  data: DashboardActivity | null;
  loading?: boolean;
}>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id || null);

// Map recent activities using the shared ActivityMapper
const activitiesViewModel = computed(() => {
  if (!props.data?.recent) return [];
  // ActivityMapper.toViewModelList signature accepts list + userId
  // Wait, let's map individual items with currentUserId
  return props.data.recent.map((act) => {
    // ActivityResponse expects slightly more fields, let's cast or mock them safely
    const mockDto = {
      id: act.id,
      action: act.action,
      createdAt: act.createdAt,
      createdBy: currentUserId.value || '',
      cardId: act.cardId,
      details: {},
    };
    return ActivityMapper.toViewModel(mockDto, currentUserId.value);
  });
});

const getIcon = (name: string) => {
  switch (name) {
    case 'ClipboardDocumentIcon':
      return ClipboardDocumentIcon;
    case 'ChatBubbleLeftEllipsisIcon':
      return ChatBubbleLeftEllipsisIcon;
    case 'ListBulletIcon':
      return ListBulletIcon;
    case 'PaperClipIcon':
      return PaperClipIcon;
    default:
      return UserIcon;
  }
};
</script>

<template>
  <div v-if="loading" class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4">
    <div class="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    <div class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-10 bg-gray-100 rounded animate-pulse" />
    </div>
  </div>

  <div
    v-else
    class="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between h-full select-none"
  >
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Workspace Activity
        </h3>
        
        <!-- Activity rate counts -->
        <div class="flex items-center space-x-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Today: {{ data?.today ?? 0 }}</span>
          <span>•</span>
          <span>Week: {{ data?.thisWeek ?? 0 }}</span>
        </div>
      </div>

      <!-- Recent items list -->
      <div v-if="activitiesViewModel.length === 0" class="py-10 text-center text-gray-400 text-xs">
        No recent activity logged in this workspace.
      </div>

      <div v-else class="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
        <div
          v-for="act in activitiesViewModel"
          :key="act.id"
          class="flex items-start space-x-3 text-xs"
        >
          <div class="p-1.5 bg-gray-50 text-gray-400 rounded-lg">
            <component :is="getIcon(act.iconName)" class="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-gray-900 leading-normal">
              <span class="font-semibold">{{ act.creatorName }}</span>
              {{ ' ' }}{{ act.actionText }}
            </p>
            <span class="block text-[10px] text-gray-400 mt-0.5">
              {{ act.relativeTime }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 pt-3.5 border-t border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
      Actions this month: {{ data?.thisMonth ?? 0 }}
    </div>
  </div>
</template>
