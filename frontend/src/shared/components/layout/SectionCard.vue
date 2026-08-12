<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <section class="bg-surface-raised border border-border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
    <!-- Header Block -->
    <div
      v-if="title || $slots.header || $slots.toolbar"
      class="px-4 py-3 border-b border-border flex flex-row items-center justify-between gap-4"
    >
      <div class="text-start">
        <slot name="header">
          <h3 v-if="title" class="text-[13px] font-semibold text-text-base">
            {{ title }}
          </h3>
          <p v-if="description" class="mt-0.5 text-[11px] text-text-muted">
            {{ description }}
          </p>
        </slot>
      </div>

      <!-- Toolbar section -->
      <div v-if="$slots.toolbar" class="flex items-center gap-1.5">
        <slot name="toolbar" />
      </div>
    </div>

    <!-- Body Section -->
    <div class="p-4">
      <slot />
    </div>

    <!-- Footer Section -->
    <div
      v-if="$slots.footer"
      class="px-4 py-3 bg-gray-50 dark:bg-gray-950/20 border-t border-border"
    >
      <slot name="footer" />
    </div>
  </section>
</template>
