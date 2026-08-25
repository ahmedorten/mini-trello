<script setup lang="ts">
import { onMounted } from 'vue';
import { useHealthStore } from '@/stores/health';

const health = useHealthStore();

onMounted(() => {
  void health.load();
});
</script>

<template>
  <section>
    <header class="status__header">
      <h1>System status</h1>
      <button type="button" :disabled="health.isLoading" @click="health.load()">
        {{ health.isLoading ? 'Checking…' : 'Refresh' }}
      </button>
    </header>

    <p v-if="health.isLoading && !health.data">Checking API…</p>

    <div v-else-if="health.error" role="alert" class="status__error">
      <strong>Cannot reach the API.</strong>
      <p>{{ health.error }}</p>
      <p>Start it with <code>npm run dev:api</code> from the repository root.</p>
    </div>

    <dl v-else-if="health.data" class="status__list">
      <dt>API</dt>
      <dd :class="health.isHealthy ? 'status__ok' : 'status__error-text'">
        {{ health.isHealthy ? 'Healthy' : 'Degraded' }}
      </dd>

      <dt>Service</dt>
      <dd>{{ health.data.service }}</dd>

      <dt>Version</dt>
      <dd>{{ health.data.version }}</dd>

      <dt>Environment</dt>
      <dd>{{ health.data.environment }}</dd>

      <dt>Uptime</dt>
      <dd>{{ health.data.uptimeSeconds }} s</dd>

      <dt>Database</dt>
      <dd :class="health.isDatabaseUp ? 'status__ok' : 'status__error-text'">
        {{ health.isDatabaseUp ? 'Connected' : 'Unavailable' }}
        ({{ health.data.database.latencyMs }} ms)
      </dd>

      <template v-if="health.data.database.message">
        <dt>Database error</dt>
        <dd>{{ health.data.database.message }}</dd>
      </template>
    </dl>

    <p v-if="health.lastCheckedAt" class="status__meta">
      Last checked {{ new Date(health.lastCheckedAt).toLocaleTimeString() }}
    </p>
  </section>
</template>

<style scoped>
.status__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.status__error {
  padding: 1rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
}

.status__list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
}

.status__list dt {
  font-weight: 600;
  color: var(--color-text-muted);
}

.status__list dd {
  margin: 0;
}

.status__ok {
  color: var(--color-ok);
  font-weight: 600;
}

.status__error-text {
  color: var(--color-error);
  font-weight: 600;
}

.status__meta {
  margin-top: 1rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>
