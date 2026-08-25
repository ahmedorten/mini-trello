<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <span class="layout__brand">Customer Support CRM</span>
    </header>

    <div class="layout__body">
      <nav class="layout__nav" aria-label="Main navigation">
        <RouterLink to="/" class="layout__link">Dashboard</RouterLink>
        <RouterLink to="/system-status" class="layout__link">System status</RouterLink>
      </nav>

      <main class="layout__main">
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
  padding: 0 1.5rem;
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
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
