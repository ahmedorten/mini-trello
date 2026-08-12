<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import BlankLayout from '@/layouts/BlankLayout.vue';
import AppLoadingOverlay from '@/shared/components/feedback/AppLoadingOverlay.vue';
import { useSession } from '@/features/auth/composables/useSession';

// TASK-207 UX System imports
import ErrorBoundary from '@/shared/components/feedback/ErrorBoundary.vue';
import ToastContainer from '@/shared/components/feedback/ToastContainer.vue';
import AppDialogContainer from '@/shared/components/dialogs/AppDialogContainer.vue';
import ThemeService from '@/shared/services/ThemeService';
import LoadingCoordinator from '@/shared/services/LoadingCoordinator';
import { useLoading } from '@/shared/composables/useLoading';

const route = useRoute();
const { status } = useSession();
const { globalLoading } = useLoading();

const layouts = {
  app: AppLayout,
  auth: AuthLayout,
  blank: BlankLayout,
};

const currentLayout = computed(() => {
  const layoutName = route.meta.layout as keyof typeof layouts;
  return layouts[layoutName] || BlankLayout;
});

const isAppLoading = computed(() => status.value === 'Loading' || globalLoading.value);

onMounted(() => {
  ThemeService.initialize();
  LoadingCoordinator.initialize();
});

onUnmounted(() => {
  ThemeService.shutdown();
  LoadingCoordinator.shutdown();
});
</script>

<template>
  <div class="relative min-h-screen bg-background text-text-base transition-colors duration-200">
    <ErrorBoundary>
      <!-- Main layout component -->
      <component :is="currentLayout">
        <router-view />
      </component>
    </ErrorBoundary>

    <!-- Global App Loading Overlay -->
    <AppLoadingOverlay :visible="isAppLoading" message="Restoring session..." />

    <!-- Global Toast Notifications Overlay -->
    <ToastContainer />

    <!-- Global Promise-based Confirm Dialogs Overlay -->
    <AppDialogContainer />
  </div>
</template>
