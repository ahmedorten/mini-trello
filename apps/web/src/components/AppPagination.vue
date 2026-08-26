<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppButton from './AppButton.vue';

const props = defineProps<{
  page: number;
  totalPages: number;
  total: number;
}>();

const emit = defineEmits<{ change: [number] }>();

const { t } = useI18n();

function previous(): void {
  if (props.page > 1) {
    emit('change', props.page - 1);
  }
}

function next(): void {
  if (props.page < props.totalPages) {
    emit('change', props.page + 1);
  }
}
</script>

<template>
  <div class="app-pagination">
    <AppButton
      variant="secondary"
      size="sm"
      icon="chevron-start"
      :disabled="page <= 1"
      @click="previous"
    >
      {{ t('common.previous') }}
    </AppButton>

    <span class="app-pagination__summary">
      {{ t('common.pagination.summary', { page, totalPages, total }) }}
    </span>

    <AppButton
      variant="secondary"
      size="sm"
      icon="chevron-end"
      :disabled="page >= totalPages"
      @click="next"
    >
      {{ t('common.next') }}
    </AppButton>
  </div>
</template>

<style scoped>
.app-pagination {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-block-start: var(--space-4);
}

.app-pagination__summary {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
