<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from '@/shared/composables/useI18n';
import { BellIcon, InboxIcon } from '@heroicons/vue/24/outline';

const { locale } = useI18n();


const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const activeTab = ref<'all' | 'mentions' | 'activity' | 'updates'>('all');

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const closeDropdown = () => {
  isOpen.value = false;
};

// Close when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Translation stubs for notification tabs
const tabs = computed(() => [
  { id: 'all', label: locale.value === 'en' ? 'All' : 'الكل' },
  { id: 'mentions', label: locale.value === 'en' ? 'Mentions' : 'الإشارات' },
  { id: 'activity', label: locale.value === 'en' ? 'Activity' : 'النشاط' },
  { id: 'updates', label: locale.value === 'en' ? 'Updates' : 'التحديثات' }
] as const);
</script>

<template>
  <div ref="containerRef" class="relative inline-block text-start">
    <!-- Bell Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-250 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:text-gray-750 dark:hover:text-gray-200 transition-colors duration-150 focus-visible:focus-ring"
      :title="locale === 'en' ? 'Notifications' : 'الإشعارات'"
      :aria-label="locale === 'en' ? 'Notifications Menu' : 'قائمة الإشعارات'"
    >
      <BellIcon class="h-5 w-5" aria-hidden="true" />
      <!-- Unread indicator dot (hidden by default) -->
      <span v-if="false" class="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
    </button>

    <!-- Dropdown Panel -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute end-0 mt-1.5 w-80 rounded-xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-md focus:outline-none z-50 overflow-hidden"
      >
        <!-- Panel Header -->
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ locale === 'en' ? 'Notifications' : 'الإشعارات' }}
          </span>
          <button
            type="button"
            class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium focus-visible:focus-ring rounded px-1"
          >
            {{ locale === 'en' ? 'Mark all as read' : 'تحديد الكل كمقروء' }}
          </button>
        </div>

        <!-- Panel Tabs -->
        <div class="flex border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-950/20 px-2 pt-1.5 gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            @click="activeTab = tab.id"
            :class="[
              'px-2.5 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 focus-visible:focus-ring',
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Panel Body (Empty State Placeholder) -->
        <div class="px-4 py-12 flex flex-col items-center justify-center text-center">
          <div class="h-10 w-10 rounded-full bg-gray-50 dark:bg-gray-850 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-3">
            <InboxIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {{ locale === 'en' ? 'No notifications yet' : 'لا توجد إشعارات بعد' }}
          </span>
          <span class="text-[11px] text-gray-400 dark:text-gray-500 mt-1 max-w-[200px]">
            {{ locale === 'en' ? 'We will let you know when something requires your attention.' : 'سنقوم بإخطارك عندما يكون هناك شيء يتطلب انتباهك.' }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>
