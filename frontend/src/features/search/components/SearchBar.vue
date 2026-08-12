<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid';
import { useSearch } from '../composables/useSearch';
import { useI18n } from '@/shared/composables/useI18n';
import SearchDropdown from './SearchDropdown.vue';
import { onClickOutside } from '@vueuse/core';

const router = useRouter();
const { searchQuery } = useSearch();
const { locale } = useI18n();

const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const dropdownOpen = ref(false);

const onFocus = () => {
  dropdownOpen.value = true;
};

// Close dropdown when clicking outside
onClickOutside(containerRef, () => {
  dropdownOpen.value = false;
});

// Navigate to the full search page on Enter press
const onEnter = () => {
  dropdownOpen.value = false;
  inputRef.value?.blur();
  router.push({ name: 'Search', query: { q: searchQuery.value } });
};

// Global keyboard shortcut to focus search input: '/' or 'Ctrl+K'
const handleGlobalKeydown = (e: KeyboardEvent) => {
  const activeEl = document.activeElement;
  const isInputActive =
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.getAttribute('contenteditable') === 'true');

  if (isInputActive) return;

  if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
    e.preventDefault();
    inputRef.value?.focus();
    dropdownOpen.value = true;
  }
};

// Escape to close dropdown
const handleLocalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    dropdownOpen.value = false;
    inputRef.value?.blur();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div ref="containerRef" class="relative w-full md:max-w-md lg:max-w-[560px] xl:max-w-[720px] select-none mx-auto">
    <div class="relative">
      <div class="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-gray-400">
        <MagnifyingGlassIcon class="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="search"
        :placeholder="locale === 'ar' ? 'البحث عن لوحات أو بطاقات... (⌘K)' : 'Search boards, cards... (⌘K)'"
        @focus="onFocus"
        @keydown.enter="onEnter"
        @keydown="handleLocalKeydown"
        class="block w-full ps-9 pe-12 py-1.5 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus-visible:focus-ring transition-all placeholder-gray-400 text-gray-900 dark:text-gray-100 shadow-xs"
        role="combobox"
        :aria-expanded="dropdownOpen"
        aria-autocomplete="list"
        aria-controls="search-listbox"
      />
      <!-- Keyboard shortcut visual indicator -->
      <div class="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none">
        <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-semibold text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-md shadow-2xs font-sans">
          ⌘K
        </kbd>
      </div>
    </div>

    <!-- Results Panel Dropdown -->
    <SearchDropdown :is-open="dropdownOpen" @close="dropdownOpen = false" />
  </div>
</template>
