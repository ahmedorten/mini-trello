<script setup lang="ts">
import { useI18n } from '@/shared/composables/useI18n';

const { locale, setLocale } = useI18n();
</script>

<template>
  <div class="bg-gray-100 dark:bg-gray-800/80 rounded-lg p-0.5 flex items-center gap-0.5 h-9 select-none">
    <button
      type="button"
      @click="setLocale('en')"
      role="menuitem"
      :class="[
        'px-2 py-1 text-[11px] font-bold rounded-md transition-all duration-150 focus-visible:focus-ring',
        locale === 'en'
          ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      ]"
      :aria-label="locale === 'en' ? 'Active: English' : 'Switch to English'"
    >
      EN
    </button>
    <button
      type="button"
      @click="setLocale('ar')"
      role="menuitem"
      :class="[
        'px-2 py-1 text-[11px] font-bold rounded-md transition-all duration-150 focus-visible:focus-ring',
        locale === 'ar'
          ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      ]"
      :aria-label="locale === 'ar' ? 'نشط: العربية' : 'التحويل للعربية'"
    >
      AR
    </button>

  </div>
</template>
