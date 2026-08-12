<script setup lang="ts">
import { useSearchHistory } from '../composables/useSearchHistory';
import { useI18n } from '@/shared/composables/useI18n';
import EmptyState from '@/shared/components/feedback/EmptyState.vue';

defineProps<{
  query: string;
}>();

const emit = defineEmits<{
  (e: 'select-term', term: string): void;
}>();

const { history } = useSearchHistory();
const { locale } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <EmptyState
      icon="face-frown"
      :title="locale === 'en' ? 'No results found' : 'لم يتم العثور على نتائج'"
      :description="locale === 'en'
        ? `We couldn't find anything matching \&quot;${query}\&quot;. Double-check your spelling or try adjusting your filter scope.`
        : `لم نجد أي نتائج تطابق \&quot;${query}\&quot;. تحقق من الإملاء أو عدّل نطاق التصفية.`"
      class="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-xs"
    >
      <template #action>
        <!-- Recent History Retries -->
        <div v-if="history.length > 0" class="mt-2 max-w-sm mx-auto">
          <span class="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {{ locale === 'en' ? 'Recent Queries' : 'عمليات البحث الأخيرة' }}
          </span>
          <div class="flex flex-wrap justify-center gap-1.5">
            <button
              v-for="term in history"
              :key="term"
              type="button"
              @click="emit('select-term', term)"
              class="px-2.5 py-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-650 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 hover:text-gray-950 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all truncate max-w-[120px]"
            >
              {{ term }}
            </button>
          </div>
        </div>
      </template>
    </EmptyState>
  </div>
</template>
