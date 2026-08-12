<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import AppSidebar from './AppSidebar.vue';
import AppHeader from './AppHeader.vue';
import AppContent from './AppContent.vue';
import BreakpointService from '../../services/BreakpointService';

const sidebarOpen = ref(false);
const sidebarCollapsed = ref(false);
const headerRef = ref<any>(null);

const toggleSidebarMobile = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const closeSidebarMobile = () => {
  sidebarOpen.value = false;
};

const toggleSidebarCollapse = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

const handleOpenProfile = () => {
  headerRef.value?.openProfile();
};

// Auto-collapse sidebar on tablet, expand on desktop
onMounted(() => {
  if (BreakpointService.isTablet.value) {
    sidebarCollapsed.value = true;
  }
});

watch(
  () => BreakpointService.isTablet.value,
  (isTablet) => {
    if (isTablet) {
      sidebarCollapsed.value = true;
    }
  }
);

watch(
  () => BreakpointService.isDesktop.value,
  (isDesktop) => {
    if (isDesktop) {
      sidebarOpen.value = false;
      sidebarCollapsed.value = false;
    }
  }
);
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-surface-base font-sans antialiased text-text-base transition-colors duration-200">
    <!-- Accessible Skip to Content Link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-primary text-white px-4 py-2 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 shadow-md"
    >
      Skip to content
    </a>

    <!-- Sidebar Navigation -->
    <AppSidebar
      :is-open="sidebarOpen"
      :is-collapsed="sidebarCollapsed"
      @close="closeSidebarMobile"
      @toggle-collapse="toggleSidebarCollapse"
      @open-profile="handleOpenProfile"
    />

    <!-- Main Workspace Viewport -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
      <!-- Workspace Header -->
      <AppHeader
        ref="headerRef"
        :sidebar-open="sidebarOpen"
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="toggleSidebarMobile"
      />

      <!-- Workspace Body Viewport -->
      <AppContent>
        <slot />
      </AppContent>
    </div>
  </div>
</template>
