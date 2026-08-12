<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { SearchResultItem } from '../types';
import {
  FolderIcon,
  ClipboardDocumentIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  ArrowUpIcon,
  ArrowLongRightIcon,
  ArrowDownIcon,
} from '@heroicons/vue/24/outline';
import { SearchAnalytics } from '../analytics/SearchAnalytics';

const props = defineProps<{
  item: SearchResultItem;
  query: string;
}>();

const emit = defineEmits<{
  (e: 'click-item'): void;
}>();

const router = useRouter();

const iconComponent = computed(() => {
  switch (props.item.icon) {
    case 'FolderIcon':
      return FolderIcon;
    case 'ClipboardDocumentIcon':
      return ClipboardDocumentIcon;
    default:
      return ClipboardDocumentIcon;
  }
});

const priorityIcon = computed(() => {
  switch (props.item.priority) {
    case 'HIGH':
      return ArrowUpIcon;
    case 'MEDIUM':
      return ArrowLongRightIcon;
    case 'LOW':
      return ArrowDownIcon;
    default:
      return null;
  }
});

const priorityClass = computed(() => {
  switch (props.item.priority) {
    case 'HIGH':
      return 'text-red-600 bg-red-50';
    case 'MEDIUM':
      return 'text-amber-600 bg-amber-50';
    case 'LOW':
      return 'text-blue-600 bg-blue-50';
    default:
      return '';
  }
});

const handleSelection = () => {
  // Track telemetry
  SearchAnalytics.trackResultClick(props.item.entityType, props.item.id, props.query);

  // Navigate using vue-router target directly
  router.push(props.item.routeTo);

  emit('click-item');
};
</script>

<template>
  <div
    role="option"
    :aria-selected="false"
    @click="handleSelection"
    class="flex items-start space-x-3.5 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-150 transition-all cursor-pointer select-none group"
  >
    <!-- Left Entity Icon -->
    <div class="p-2 bg-gray-50 text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600 rounded-xl transition-all flex-shrink-0">
      <component :is="iconComponent" class="h-4.5 w-4.5" aria-hidden="true" />
    </div>

    <!-- Center Info -->
    <div class="flex-1 min-w-0 space-y-1">
      <div class="flex items-center space-x-2">
        <h4 class="text-xs font-bold text-gray-900 group-hover:text-brand-700 transition-colors truncate">
          {{ item.title }}
        </h4>

        <!-- Priority indicator -->
        <span
          v-if="item.priority"
          class="inline-flex items-center p-0.5 rounded-full"
          :class="priorityClass"
          :title="`Priority: ${item.priority}`"
        >
          <component :is="priorityIcon" class="h-3 w-3" aria-hidden="true" />
        </span>
      </div>

      <div class="flex items-center space-x-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
        <span>{{ item.breadcrumb }}</span>
        <span v-if="item.dueDate" class="text-gray-300">•</span>
        <span v-if="item.dueDate" class="text-gray-500 font-medium">Due: {{ item.dueDate }}</span>
      </div>

      <!-- Description Snippet -->
      <p
        v-if="item.meta.description"
        class="text-[11px] text-gray-500 line-clamp-1 leading-relaxed"
      >
        {{ item.meta.description }}
      </p>

      <!-- Label Chips -->
      <div v-if="item.labels.length > 0" class="flex flex-wrap gap-1 pt-1">
        <span
          v-for="lbl in item.labels"
          :key="lbl.id"
          class="inline-block h-1.5 w-6 rounded-full"
          :style="{ backgroundColor: lbl.color }"
          :title="lbl.name"
        />
      </div>
    </div>

    <!-- Right Extra Meta Indicators (Counts) -->
    <div
      v-if="item.entityType === 'card'"
      class="flex items-center space-x-2 text-gray-400 text-[10px] font-semibold self-center"
    >
      <div v-if="item.meta.commentsCount" class="flex items-center space-x-0.5">
        <ChatBubbleLeftRightIcon class="h-3.5 w-3.5" />
        <span>{{ item.meta.commentsCount }}</span>
      </div>
      <div v-if="item.meta.attachmentsCount" class="flex items-center space-x-0.5">
        <PaperClipIcon class="h-3.5 w-3.5" />
        <span>{{ item.meta.attachmentsCount }}</span>
      </div>
    </div>
  </div>
</template>
