<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

import { useRouter } from 'vue-router';
import { useSession } from '@/features/auth/composables/useSession';
import { useI18n } from '@/shared/composables/useI18n';
import { NotificationCenter } from '@/shared/services/NotificationCenter';
import BaseAvatar from '../base/BaseAvatar.vue';
import LanguageToggle from './LanguageToggle.vue';
import ThemeToggle from './ThemeToggle.vue';
import {
  ArrowLeftOnRectangleIcon,
  GlobeAltIcon,
  SunIcon,
} from '@heroicons/vue/24/outline';

const router = useRouter();
const { user, logout } = useSession();
const { t, locale } = useI18n();

const isOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);
const focusedIndex = ref(-1);

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    focusedIndex.value = -1;
  }
};

const closeMenu = () => {
  isOpen.value = false;
  focusedIndex.value = -1;
};

// Handle clicks outside the dropdown to close it
const handleClickOutside = (event: MouseEvent) => {
  if (
    isOpen.value &&
    triggerRef.value &&
    !triggerRef.value.contains(event.target as Node) &&
    menuRef.value &&
    !menuRef.value.contains(event.target as Node)
  ) {
    closeMenu();
  }
};

// Keyboard Accessibility
const handleKeyDown = async (event: KeyboardEvent) => {
  if (!isOpen.value) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      isOpen.value = true;
      focusedIndex.value = 0;
      await nextTick();
      focusItem(0);
    }
    return;
  }

  // Find all focusable items in the menu
  const menuItems = menuRef.value?.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
  if (!menuItems || menuItems.length === 0) return;

  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      closeMenu();
      triggerRef.value?.focus();
      break;
    case 'ArrowDown':
      event.preventDefault();
      focusedIndex.value = (focusedIndex.value + 1) % menuItems.length;
      focusItem(focusedIndex.value);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusedIndex.value = (focusedIndex.value - 1 + menuItems.length) % menuItems.length;
      focusItem(focusedIndex.value);
      break;
    case 'Tab':
      closeMenu();
      break;
  }
};

const focusItem = (index: number) => {
  if (menuRef.value) {
    const buttons = menuRef.value.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
    if (buttons[index]) {
      buttons[index].focus();
    }
  }
};

// Trigger actions


const handleLogoutClick = async () => {
  try {
    await logout();
    NotificationCenter.toast(t('auth.logout') + ' ' + t('auth.loginSuccess').split('!')[0], 'success');
    router.push('/login');
  } catch (e: any) {
    NotificationCenter.toast(e?.message || 'Failed to sign out.', 'error');
  }
  closeMenu();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Expose toggleMenu so parent AppHeader (and AppShell) can open it
defineExpose({
  toggleMenu,
  isOpen,
});
</script>

<template>
  <div class="relative inline-block text-start">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      type="button"
      @click="toggleMenu"
      @keydown="handleKeyDown"
      class="flex items-center gap-2 p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 focus-visible:focus-ring"
      id="user-menu-button"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-label="User Profile Menu"
    >
      <BaseAvatar :name="user?.fullName || 'User'" size="xs" />
      <span class="hidden md:inline-block text-xs font-semibold text-gray-700 dark:text-gray-300 select-none max-w-[120px] truncate">
        {{ user?.fullName || 'Profile' }}
      </span>
      <!-- Chevron Icon -->
      <svg
        class="h-3.5 w-3.5 text-gray-400 transform transition-transform"
        :class="{ 'rotate-180': isOpen }"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        class="absolute end-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-md divide-y divide-gray-100 dark:divide-gray-800 focus:outline-none z-30 overflow-hidden"
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="user-menu-button"
        tabindex="-1"
        @keydown="handleKeyDown"
      >
        <!-- User Info Header Section -->
        <div class="px-4 py-3 select-none text-start flex items-center gap-3 bg-gray-50/55 dark:bg-gray-950/20">
          <BaseAvatar :name="user?.fullName || 'User'" size="sm" class="flex-shrink-0" />
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
              {{ user?.fullName }}
            </h4>
            <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5 font-medium">
              {{ user?.email }}
            </p>
            <span class="inline-block text-[9px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded mt-1.5 uppercase">
              {{ user?.role || 'owner' }}
            </span>
          </div>
        </div>



        <!-- Section 2: Preferences -->
        <div class="py-1" role="none">
          <div class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3.5 py-1">
            {{ locale === 'en' ? 'Preferences' : 'التفضيلات' }}
          </div>
          <!-- Language Row with Inline Toggle -->
          <div class="flex items-center justify-between w-full px-3.5 py-1.5 text-xs text-gray-700 dark:text-gray-300">
            <div class="flex items-center gap-3">
              <GlobeAltIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span class="font-medium">{{ locale === 'en' ? 'Language' : 'اللغة' }}</span>
            </div>
            <!-- The LanguageToggle is interactive, its buttons have role="menuitem" to be captured in keyboard navigation -->
            <LanguageToggle class="scale-90 origin-right rtl:origin-left" />
          </div>
          <!-- Theme Row with Inline Toggle -->
          <div class="flex items-center justify-between w-full px-3.5 py-1.5 text-xs text-gray-700 dark:text-gray-300">
            <div class="flex items-center gap-3">
              <SunIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span class="font-medium">{{ locale === 'en' ? 'Theme' : 'المظهر' }}</span>
            </div>
            <ThemeToggle pill class="scale-90 origin-right rtl:origin-left" />
          </div>
        </div>



        <!-- Section 4: Logout -->
        <div class="py-1" role="none">
          <button
            type="button"
            @click="handleLogoutClick"
            class="flex items-center gap-3 w-full px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none focus:bg-red-50 dark:focus:bg-red-950/20"
            role="menuitem"
            :tabindex="isOpen ? 0 : -1"
          >
            <ArrowLeftOnRectangleIcon class="h-4 w-4 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span class="font-bold">{{ t('auth.logout') }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
