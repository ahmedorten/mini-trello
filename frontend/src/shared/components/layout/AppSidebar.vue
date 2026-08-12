<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { navigationConfig } from '@/core/navigation/navigation';
import { PermissionGuard } from '@/core/permissions/PermissionGuard';
import { Role } from '@/core/permissions/Role';
import { useSession } from '@/features/auth/composables/useSession';
import { useI18n } from '@/shared/composables/useI18n';
import BaseTooltip from '../base/BaseTooltip.vue';
import BaseAvatar from '../base/BaseAvatar.vue';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  isOpen: boolean;
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle-collapse'): void;
  (e: 'open-profile'): void;
}>();

const { user } = useSession();
const { t } = useI18n();

const sidebarRef = ref<HTMLElement | null>(null);

// Body scroll lock on mobile
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    }
  }
);

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});

// Close on ESC
const handleKeyDownEsc = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

// Focus trap logic for mobile overlay
const handleTabFocus = (event: KeyboardEvent) => {
  if (event.key !== 'Tab' || !props.isOpen) return;

  const focusableEls = sidebarRef.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  if (!focusableEls || focusableEls.length === 0) return;

  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === firstEl) {
      lastEl.focus();
      event.preventDefault();
    }
  } else {
    if (document.activeElement === lastEl) {
      firstEl.focus();
      event.preventDefault();
    }
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDownEsc);
  window.addEventListener('keydown', handleTabFocus);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDownEsc);
  window.removeEventListener('keydown', handleTabFocus);
});

// Filter navigation items dynamically based on roles and permissions
const filteredNavigation = computed(() => {
  const role = user.value?.role || Role.OWNER;
  return navigationConfig.filter((item) => {
    if (!item.permission) return true;
    return PermissionGuard.hasPermission(role, item.permission);
  });
});

const getTranslatedTitle = (title: string) => {
  if (title === 'Dashboard') return t('sidebar.dashboard');
  if (title === 'Boards') return t('sidebar.boards');
  if (title === 'Global Search') return t('sidebar.search');
  return title;
};

// Keyboard navigation handlers
const handleNavKeydown = (event: KeyboardEvent, index: number) => {
  const links = sidebarRef.value?.querySelectorAll('.nav-item-link') as NodeListOf<HTMLAnchorElement>;
  if (!links || links.length === 0) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = (index + 1) % links.length;
    links[nextIndex]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = (index - 1 + links.length) % links.length;
    links[prevIndex]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    links[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    links[links.length - 1]?.focus();
  }
};

// Format User Role display string
const userRoleLabel = computed(() => {
  const r = user.value?.role;
  if (r === Role.OWNER) return 'Owner';
  if (r === Role.MEMBER) return 'Member';
  if (r === Role.GUEST) return 'Guest';
  return 'Owner';
});
</script>

<template>
  <!-- Mobile Sidebar Overlay (Background backdrop) -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      @click="emit('close')"
      class="fixed inset-0 z-30 bg-gray-950/50 backdrop-blur-sm md:hidden"
      aria-hidden="true"
    ></div>
  </Transition>

  <!-- Sidebar Container -->
  <aside
    ref="sidebarRef"
    id="app-sidebar"
    class="fixed inset-y-0 start-0 z-40 flex flex-col bg-[#0d0f14] text-gray-100 border-e border-gray-900/60 transition-[width,transform] duration-300 ease-out md:static md:translate-x-0 flex-shrink-0"
    :class="[
      isOpen ? 'translate-x-0' : 'max-md:-translate-x-full max-md:rtl:translate-x-full',
      isCollapsed ? 'w-[72px]' : 'w-[260px]',
    ]"
    role="navigation"
    aria-label="Main Navigation"
  >
    <!-- Sidebar Header / Logo -->
    <div class="flex items-center justify-between h-[58px] px-4.5 border-b border-gray-900/40 select-none">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm transition-all focus-visible:focus-ring-invert">
          MT
        </div>
        <span
          class="font-semibold text-sm tracking-wide whitespace-nowrap transition-all duration-200 text-gray-100"
          :class="isCollapsed ? 'opacity-0 w-0' : 'opacity-100'"
        >
          Mini Trello
        </span>
      </div>

      <!-- Mobile close button -->
      <button
        type="button"
        @click="emit('close')"
        class="md:hidden p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:focus-ring-invert"
        aria-label="Close sidebar navigation menu"
      >
        <XMarkIcon class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Navigation Links Rail -->
    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <div v-for="(item, index) in filteredNavigation" :key="item.id">
        <!-- Collapsed Link Mode -->
        <BaseTooltip v-if="isCollapsed" :text="getTranslatedTitle(item.title)" position="end" class="w-full">
          <router-link
            :to="item.route"
            @click="emit('close')"
            @keydown="handleNavKeydown($event, index)"
            active-class="bg-indigo-600/15 text-white border-s-[3px] border-indigo-500 font-semibold"
            class="nav-item-link flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-gray-400 hover:bg-gray-800/40 hover:text-gray-100 transition-all duration-150 focus-visible:focus-ring-invert"
          >
            <component :is="item.icon" class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">{{ getTranslatedTitle(item.title) }}</span>
          </router-link>
        </BaseTooltip>

        <!-- Expanded Link Mode -->
        <router-link
          v-else
          :to="item.route"
          @click="emit('close')"
          @keydown="handleNavKeydown($event, index)"
          active-class="bg-indigo-600/15 text-white border-s-[3px] border-indigo-500 font-semibold rounded-s-none"
          class="nav-item-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800/40 hover:text-gray-100 transition-all duration-150 focus-visible:focus-ring-invert"
        >
          <component :is="item.icon" class="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span class="truncate transition-opacity duration-200">{{ getTranslatedTitle(item.title) }}</span>
          <!-- Badge Placeholder support -->
          <span
            v-if="(item as any).badge !== undefined"
            class="ms-auto bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full"
          >
            {{ (item as any).badge }}
          </span>
        </router-link>
      </div>
    </nav>

    <!-- Pinned User Section at Bottom -->
    <div class="border-t border-gray-900/60 p-3 bg-gray-950/20">
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- User Details / Trigger -->
        <button
          type="button"
          @click="emit('open-profile')"
          class="flex items-center gap-2.5 min-w-0 text-start rounded-lg hover:bg-gray-800/40 p-1 transition-all duration-150 focus-visible:focus-ring-invert flex-1"
          :title="isCollapsed ? user?.fullName || 'Profile' : ''"
        >
          <BaseAvatar :name="user?.fullName || 'User'" size="sm" class="flex-shrink-0" />
          <div
            class="min-w-0 flex-1 transition-all duration-200"
            :class="isCollapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100'"
          >
            <h4 class="text-xs font-semibold text-gray-200 truncate leading-tight">
              {{ user?.fullName }}
            </h4>
            <p class="text-[10px] text-gray-400 truncate mt-0.5">
              {{ userRoleLabel }}
            </p>
          </div>
        </button>

        <!-- Collapse/Expand toggle button (Desktop only) -->
        <button
          v-if="!isCollapsed"
          type="button"
          @click="emit('toggle-collapse')"
          class="hidden md:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:focus-ring-invert"
          :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <ChevronLeftIcon class="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      <!-- Single button to expand if collapsed -->
      <div v-if="isCollapsed" class="hidden md:flex items-center justify-center mt-2">
        <button
          type="button"
          @click="emit('toggle-collapse')"
          class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:focus-ring-invert"
          :aria-label="t('sidebar.themeToggle')"
        >
          <ChevronRightIcon class="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>
