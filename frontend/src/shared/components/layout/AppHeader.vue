<script setup lang="ts">
import { ref } from 'vue';
import { Bars3Icon } from '@heroicons/vue/24/outline';
import ProfileMenu from './ProfileMenu.vue';
import LanguageToggle from './LanguageToggle.vue';
import ThemeToggle from './ThemeToggle.vue';
import NotificationPanel from './NotificationPanel.vue';
import SearchBar from '@/features/search/components/SearchBar.vue';

defineProps<{
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const profileMenuRef = ref<any>(null);


// Expose openProfile for programmatical activation from sidebar
defineExpose({
  openProfile: () => {
    profileMenuRef.value?.toggleMenu();
  }
});
</script>

<template>
  <header class="h-[58px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100/80 dark:border-gray-800/50 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
    <!-- Left Section: Mobile Menu Trigger -->
    <div class="flex items-center gap-2 flex-shrink-0 md:hidden">
      <button
        type="button"
        @click="emit('toggle-sidebar')"
        class="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:focus-ring"
        aria-label="Toggle sidebar navigation"
        :aria-expanded="sidebarOpen"
      >
        <Bars3Icon class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Center/Main Section: Responsive Search Bar -->
    <div class="flex-1 flex items-center justify-start md:justify-center px-2 md:px-4 min-w-0">
      <SearchBar />
    </div>

    <!-- Right Section: Grouped controls (Quick Actions -> Preferences -> Notifications -> Profile) -->
    <div class="flex items-center gap-2.5 flex-shrink-0">
      <!-- Quick Actions Placeholder -->
      <div class="hidden md:flex items-center gap-1">
        <!-- Future quick actions can go here -->
      </div>

      <!-- Divider (Only on desktop) -->
      <div class="hidden md:block h-4 w-px bg-gray-200/80 dark:bg-gray-800/60"></div>

      <!-- Preferences Group (Language + Theme) -->
      <div class="flex items-center gap-1.5">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <!-- Divider -->
      <div class="h-4 w-px bg-gray-200/80 dark:bg-gray-800/60"></div>

      <!-- Notifications -->
      <NotificationPanel />

      <!-- Divider -->
      <div class="h-4 w-px bg-gray-200/80 dark:bg-gray-800/60"></div>

      <!-- User Profile Dropdown -->
      <ProfileMenu ref="profileMenuRef" />
    </div>
  </header>
</template>
