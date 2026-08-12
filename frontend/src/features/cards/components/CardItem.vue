<script setup lang="ts">
import { computed } from 'vue';

import type { Card } from '../types/models/Card';
import dayjs from 'dayjs';
import FormatterService from '@/shared/services/FormatterService';
import BaseIcon from '@/shared/components/base/BaseIcon.vue';
import StatusBadge from '@/shared/components/base/StatusBadge.vue';
import { DragDropService } from '../services/DragDropService';

const props = defineProps<{
  card: Card;
}>();

const formattedDueDate = computed(() => {
  if (!props.card.dueDate) return '';
  return FormatterService.formatDate(props.card.dueDate, 'MMM D');
});

const isOverdue = computed(() => {
  if (!props.card.dueDate) return false;
  return dayjs(props.card.dueDate).isBefore(dayjs(), 'day') && !props.card.isArchived;
});

const isGrabbed = computed(() => DragDropService.draggedCard.value?.id === props.card.id);
</script>

<template>
  <div
    class="flex flex-col bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800/80 p-3.5 rounded-xl shadow-xs hover:-translate-y-0.5 hover:shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-200 select-none group/card focus-within:ring-2 focus-within:ring-indigo-500/25 relative"
    role="button"
    tabindex="0"
    :aria-label="`Card: ${card.title}, priority: ${card.priority}`"
    :data-card-id="card.id"
    :aria-grabbed="isGrabbed"
    aria-dropeffect="move"
  >
    <!-- Grip / Drag Handle (Hidden by default, shown on hover/focus) -->
    <div
      class="card-drag-handle absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-100 transition-all duration-150"
      aria-label="Drag handle"
      role="button"
      tabindex="-1"
    >
      <BaseIcon name="ellipsis-vertical" size="xs" />
    </div>

    <!-- Labels and Badges Row -->
    <div v-if="card.labels && card.labels.length > 0" class="flex flex-wrap gap-1 mb-2">
      <span
        v-for="label in card.labels"
        :key="label.id"
        class="h-1.5 w-8 rounded-full"
        :style="{ backgroundColor: label.color }"
        :title="label.name"
      ></span>
    </div>

    <!-- Title -->
    <h4 class="text-sm font-semibold text-gray-950 dark:text-gray-100 leading-snug group-hover/card:text-indigo-650 dark:group-hover/card:text-indigo-400 transition-colors text-start">
      {{ card.title }}
    </h4>

    <!-- Description Snippet -->
    <p v-if="card.description" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 text-start">
      {{ card.description }}
    </p>

    <!-- Metadata Details Footer -->
    <div class="flex items-center justify-between mt-3.5 pt-2.5 border-t border-gray-150 dark:border-gray-800/80">
      <div class="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
        <!-- Due Date Indicator -->
        <div
          v-if="card.dueDate"
          class="flex items-center gap-1"
          :class="isOverdue ? 'text-red-650 font-bold' : ''"
        >
          <BaseIcon name="calendar" size="xs" />
          <span>{{ formattedDueDate }}</span>
        </div>

        <!-- Comments Counter -->
        <div v-if="card.commentsCount > 0" class="flex items-center gap-1" title="Comments">
          <BaseIcon name="chat-bubble-left-ellipsis" size="xs" />
          <span>{{ card.commentsCount }}</span>
        </div>

        <!-- Attachments Counter -->
        <div v-if="card.attachmentsCount > 0" class="flex items-center gap-1" title="Attachments">
          <BaseIcon name="paper-clip" size="xs" />
          <span>{{ card.attachmentsCount }}</span>
        </div>

        <!-- Checklist Items Progress -->
        <div v-if="card.totalItems > 0" class="flex items-center gap-1" :class="card.completedItems === card.totalItems ? 'text-emerald-605 font-bold' : ''" title="Checklist progress">
          <BaseIcon name="clipboard-document-check" size="xs" />
          <span>{{ card.completedItems }}/{{ card.totalItems }}</span>
        </div>
      </div>

      <!-- Priority Badge -->
      <StatusBadge v-if="card.priority" type="priority" :value="card.priority" />
    </div>
  </div>
</template>
