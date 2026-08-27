<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHealthStore } from '@/stores/health';
import AppButton from '@/components/AppButton.vue';

const health = useHealthStore();
const { t, d, n } = useI18n();

onMounted(() => {
  void health.load();
});
</script>

<template>
  <section>
    <header class="status__header">
      <h1>{{ t('systemStatus.title') }}</h1>
      <AppButton variant="secondary" :loading="health.isLoading" @click="health.load()">
        {{ health.isLoading ? t('systemStatus.checking') : t('systemStatus.refresh') }}
      </AppButton>
    </header>

    <p v-if="health.isLoading && !health.data">{{ t('systemStatus.checkingApi') }}</p>

    <div v-else-if="health.error" role="alert" class="form-error">
      <strong>{{ t('systemStatus.cannotReach') }}</strong>
      <p>{{ health.error }}</p>
      <p>
        <i18n-t keypath="systemStatus.startHint" tag="span" scope="global">
          <template #command><code>npm run dev:api</code></template>
        </i18n-t>
      </p>
    </div>

    <dl v-else-if="health.data" class="status__list">
      <dt>{{ t('systemStatus.api') }}</dt>
      <dd :class="health.isHealthy ? 'status__ok' : 'status__error-text'">
        {{ health.isHealthy ? t('systemStatus.healthy') : t('systemStatus.degraded') }}
      </dd>

      <dt>{{ t('systemStatus.service') }}</dt>
      <dd>{{ health.data.service }}</dd>

      <dt>{{ t('systemStatus.version') }}</dt>
      <dd>{{ health.data.version }}</dd>

      <dt>{{ t('systemStatus.environment') }}</dt>
      <dd>{{ health.data.environment }}</dd>

      <dt>{{ t('systemStatus.uptime') }}</dt>
      <dd>{{ t('systemStatus.uptimeValue', { seconds: n(health.data.uptimeSeconds, 'decimal') }) }}</dd>

      <dt>{{ t('systemStatus.database') }}</dt>
      <dd :class="health.isDatabaseUp ? 'status__ok' : 'status__error-text'">
        {{ health.isDatabaseUp ? t('systemStatus.connected') : t('systemStatus.unavailable') }}
        ({{ n(health.data.database.latencyMs, 'decimal') }} ms)
      </dd>

      <template v-if="health.data.database.message">
        <dt>{{ t('systemStatus.databaseError') }}</dt>
        <dd>{{ health.data.database.message }}</dd>
      </template>
    </dl>

    <p v-if="health.lastCheckedAt" class="status__meta">
      {{ t('systemStatus.lastChecked', { time: d(new Date(health.lastCheckedAt), 'long') }) }}
    </p>
  </section>
</template>

<style scoped>
.status__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--space-5);
}

.status__list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-5);
}

.status__list dt {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.status__list dd {
  margin: 0;
}

.status__ok {
  color: var(--color-ok);
  font-weight: var(--font-weight-semibold);
}

.status__error-text {
  color: var(--color-error);
  font-weight: var(--font-weight-semibold);
}

.status__meta {
  margin-block-start: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}
</style>
