<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const showPasswordBanner = ref(true);

async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <span class="layout__brand">Customer Support CRM</span>

      <div v-if="auth.isAuthenticated" class="layout__identity">
        <span class="layout__user">{{ auth.user?.fullName }}</span>
        <span v-if="auth.user?.roles[0]" class="layout__role">{{ auth.user.roles[0] }}</span>
        <button type="button" class="layout__signout" @click="signOut">Sign out</button>
      </div>
    </header>

    <div class="layout__body">
      <nav v-if="auth.isAuthenticated" class="layout__nav" aria-label="Main navigation">
        <RouterLink to="/" class="layout__link">Dashboard</RouterLink>
        <RouterLink to="/system-status" class="layout__link">System status</RouterLink>
        <RouterLink v-if="auth.can('users:read')" to="/users" class="layout__link">Users</RouterLink>
        <RouterLink v-if="auth.can('customers:read')" to="/customers" class="layout__link">Customers</RouterLink>
        <RouterLink v-if="auth.can('tickets:read')" to="/tickets" class="layout__link">Tickets</RouterLink>
      </nav>

      <main class="layout__main">
        <!-- Story 07 deferred the self-service password change endpoint, so this
             banner cannot link anywhere — that follow-up screen does not exist yet. -->
        <div
          v-if="auth.user?.mustChangePassword && showPasswordBanner"
          class="layout__banner"
          role="status"
        >
          <span>Your password was set by an administrator. Ask an administrator to change it for you.</span>
          <button type="button" @click="showPasswordBanner = false">Dismiss</button>
        </div>

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
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.layout__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.layout__role {
  color: var(--color-text-muted);
}

.layout__signout {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}

.layout__banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  background: color-mix(in srgb, var(--color-accent) 10%, white);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
}

.layout__brand {
  font-weight: 600;
  font-size: 1.05rem;
}

.layout__body {
  display: flex;
  flex: 1;
}

.layout__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 220px;
  flex-shrink: 0;
  padding: 1.5rem 1rem;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.layout__link {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.95rem;
}

.layout__link:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.layout__link.router-link-active {
  background: var(--color-accent);
  color: #ffffff;
}

.layout__main {
  flex: 1;
  padding: 2rem;
}
</style>
