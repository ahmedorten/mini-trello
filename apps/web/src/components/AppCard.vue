<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
  }>(),
  { title: undefined, subtitle: undefined },
);
</script>

<template>
  <section class="app-card">
    <header v-if="title || subtitle || $slots.header || $slots.actions" class="app-card__header">
      <div v-if="title || subtitle || $slots.header" class="app-card__heading">
        <slot name="header">
          <h2 v-if="title" class="app-card__title">{{ title }}</h2>
          <p v-if="subtitle" class="app-card__subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div v-if="$slots.actions" class="app-card__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="app-card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="app-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.app-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
}

.app-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-block-end: 1px solid var(--color-border);
}

.app-card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.app-card__subtitle {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.app-card__body {
  padding: var(--space-5);
}

.app-card__footer {
  padding: var(--space-4) var(--space-5);
  border-block-start: 1px solid var(--color-border);
}
</style>
