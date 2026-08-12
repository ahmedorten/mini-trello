<script setup lang="ts">
import { ChevronRightIcon } from '@heroicons/vue/20/solid';

defineProps<{
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; route?: string }>;
}>();
</script>

<template>
  <header class="mb-5 border-b border-gray-150 dark:border-gray-800/80 pb-4 transition-colors duration-200 select-none">
    <!-- Breadcrumb Section -->
    <div v-if="breadcrumbs && breadcrumbs.length > 0" class="mb-3">
      <nav class="flex items-center flex-wrap gap-1 text-[11px] font-semibold text-text-muted">
        <div v-for="(crumb, idx) in breadcrumbs" :key="idx" class="flex items-center gap-1">
          <router-link
            v-if="crumb.route && idx < breadcrumbs.length - 1"
            :to="crumb.route"
            class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {{ crumb.label }}
          </router-link>
          <span v-else class="text-text-base font-semibold">
            {{ crumb.label }}
          </span>
          <ChevronRightIcon
            v-if="idx < breadcrumbs.length - 1"
            class="h-3 w-3 text-gray-400 dark:text-gray-600 rtl:rotate-180 flex-shrink-0"
            aria-hidden="true"
          />
        </div>
      </nav>
    </div>
    <!-- Legacy Custom Breadcrumb Slot -->
    <div v-else-if="$slots.breadcrumbs" class="mb-2.5">
      <slot name="breadcrumbs" />
    </div>

    <!-- Title and Action block -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex-1 min-w-0 text-start">
        <h1 class="text-xl md:text-2xl font-bold tracking-tight text-text-base leading-none">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-2 text-xs md:text-sm text-text-muted font-medium">
          {{ subtitle }}
        </p>
      </div>

      <!-- Action slot -->
      <div v-if="$slots.actions" class="flex items-center gap-2 justify-start md:justify-end shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
