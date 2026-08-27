<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import AppIcon from '@/components/AppIcon.vue';
import AppButton from '@/components/AppButton.vue';
import AppStateBlock from '@/components/AppStateBlock.vue';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';
import type { IconName } from '@/components/icons';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const showPasswordBanner = ref(true);
const isNavOpen = ref(false);

interface NavItem {
  to: string;
  icon: IconName;
  labelKey: string;
  visible: boolean;
}

interface NavGroup {
  key: string;
  labelKey: string;
  items: NavItem[];
}

const navGroups = computed<NavGroup[]>(() => {
  const groups: NavGroup[] = [
    {
      key: 'work',
      labelKey: 'nav.group.work',
      items: [
        { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard', visible: true },
        { to: '/workspace', icon: 'workspace', labelKey: 'nav.workspace', visible: auth.can('tickets:read') },
        // Preserves the exact auth.can('tickets:read') gate from the original nav.
        { to: '/tickets', icon: 'tickets', labelKey: 'nav.tickets', visible: auth.can('tickets:read') },
        { to: '/tasks', icon: 'tasks', labelKey: 'nav.tasks', visible: auth.can('tasks:read') },
        // The Work group, not Records: an inbox is something an agent works,
        // not a record they look up.
        { to: '/communication', icon: 'communication', labelKey: 'nav.communication', visible: auth.can('customers:read') },
      ],
    },
    {
      key: 'records',
      labelKey: 'nav.group.records',
      items: [
        // Preserves the exact auth.can('customers:read') gate from the original nav.
        { to: '/customers', icon: 'customers', labelKey: 'nav.customers', visible: auth.can('customers:read') },
      ],
    },
    {
      key: 'administration',
      labelKey: 'nav.group.administration',
      items: [
        // Preserves the exact auth.can('users:read') gate from the original nav.
        { to: '/users', icon: 'users', labelKey: 'nav.users', visible: auth.can('users:read') },
        { to: '/system-status', icon: 'status', labelKey: 'nav.systemStatus', visible: true },
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible) }))
    .filter((group) => group.items.length > 0);
});

function closeDrawer(): void {
  isNavOpen.value = false;
}

function toggleDrawer(): void {
  isNavOpen.value = !isNavOpen.value;
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isNavOpen.value) {
    closeDrawer();
  }
}

const removeAfterEach = router.afterEach(() => {
  closeDrawer();
});

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  removeAfterEach();
});

async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="layout">
    <a href="#main-content" class="skip-link">{{ t('a11y.skipToContent') }}</a>

    <header class="layout__header">
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="layout__menu-toggle"
        :aria-label="isNavOpen ? t('a11y.closeMenu') : t('a11y.openMenu')"
        @click="toggleDrawer"
      >
        <AppIcon name="menu" />
      </button>

      <span class="layout__brand">{{ t('app.name') }}</span>

      <div v-if="auth.isAuthenticated" class="layout__identity">
        <LocaleSwitcher />
        <span class="layout__user">{{ auth.user?.fullName }}</span>
        <span v-if="auth.user?.roles[0]" class="layout__role">{{ t(`role.${auth.user.roles[0]}`) }}</span>
        <AppButton
          variant="ghost"
          size="sm"
          icon="logout"
          class="layout__signout"
          @click="signOut"
        >
          {{ t('auth.signOut') }}
        </AppButton>
      </div>
    </header>

    <div class="layout__body">
      <template v-if="auth.isAuthenticated">
        <div
          v-if="isNavOpen"
          class="layout__nav-overlay"
          @click="closeDrawer"
        />

        <nav
          class="layout__nav"
          :class="{ 'layout__nav--open': isNavOpen }"
          :aria-label="t('a11y.mainNavigation')"
        >
          <div v-for="group in navGroups" :key="group.key" class="layout__nav-group">
            <h2 class="sr-only">{{ t(group.labelKey) }}</h2>
            <p class="layout__nav-caption" aria-hidden="true">{{ t(group.labelKey) }}</p>

            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="layout__link"
            >
              <AppIcon :name="item.icon" :size="18" />
              <span>{{ t(item.labelKey) }}</span>
            </RouterLink>
          </div>
        </nav>
      </template>

      <main id="main-content" class="layout__main" tabindex="-1">
        <!-- Story 07 deferred the self-service password change endpoint, so this
             banner cannot link anywhere — that follow-up screen does not exist yet. -->
        <AppStateBlock
          v-if="auth.user?.mustChangePassword && showPasswordBanner"
          variant="warning"
          :message="t('auth.mustChangePassword')"
          class="layout__banner"
        >
          <template #actions>
            <AppButton variant="ghost" size="sm" @click="showPasswordBanner = false">
              {{ t('common.dismiss') }}
            </AppButton>
          </template>
        </AppStateBlock>

        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding-inline: var(--space-5);
  block-size: var(--header-height);
  background: var(--color-surface);
  border-block-end: 1px solid var(--color-border);
}

.layout__menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}

.layout__brand {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
}

.layout__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  margin-inline-start: auto;
}

.layout__role {
  color: var(--color-text-muted);
}

.layout__banner {
  margin-block-end: var(--space-5);
}

.layout__body {
  display: flex;
  flex: 1;
  position: relative;
}

.layout__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  inline-size: var(--sidebar-width);
  flex-shrink: 0;
  padding: var(--space-5) var(--space-3);
  background: var(--color-surface);
  border-inline-end: 1px solid var(--color-border);
}

.layout__nav-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.layout__nav-caption {
  margin: 0 0 var(--space-1);
  padding-inline: var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.layout__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--font-size-sm);
}

.layout__link:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.layout__link.router-link-active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: var(--font-weight-medium);
}

.layout__nav-overlay {
  display: none;
}

.layout__main {
  flex: 1;
  min-inline-size: 0;
  padding: var(--space-6);
  max-inline-size: var(--content-max-width);
}

.layout__main:focus {
  outline: none;
}

@media (max-width: 899px) {
  .layout__menu-toggle {
    display: inline-flex;
  }

  .layout__nav {
    position: fixed;
    inset-block: var(--header-height) 0;
    inset-inline-start: -100%;
    max-inline-size: 85vw;
    z-index: 900;
    box-shadow: var(--shadow-overlay);
    transition: inset-inline-start 0.2s ease;
  }

  .layout__nav--open {
    inset-inline-start: 0;
  }

  .layout__nav-overlay {
    display: block;
    position: fixed;
    inset: var(--header-height) 0 0 0;
    z-index: 890;
    background: var(--color-overlay);
  }
}

@media (prefers-reduced-motion: reduce) {
  .layout__nav {
    transition: none;
  }
}
</style>
