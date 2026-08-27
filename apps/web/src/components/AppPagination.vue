<script lang="ts">
/** The API caps pageSize at MAX_PAGE_SIZE = 100
 *  (apps/api/src/common/dto/pagination.dto.ts:5). An option above it is a
 *  guaranteed 400, so the ceiling is stated here, once. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
</script>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppButton from './AppButton.vue';

const props = withDefaults(
  defineProps<{
    page: number;
    totalPages: number;
    total: number;
    /** Omit to render the two-button pagination exactly as before
     *  (Product rule 1). */
    pageSize?: number;
    pageSizeOptions?: readonly number[];
  }>(),
  { pageSize: undefined, pageSizeOptions: () => PAGE_SIZE_OPTIONS },
);

const emit = defineEmits<{ change: [number]; pageSizeChange: [number] }>();

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

function onPageSizeChange(event: Event): void {
  emit('pageSizeChange', Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="app-pagination">
    <label v-if="pageSize !== undefined" class="app-pagination__page-size">
      {{ t('common.pageSize.label') }}
      <select :value="pageSize" @change="onPageSizeChange">
        <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>

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
  flex-wrap: wrap;
}

.app-pagination__page-size {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.app-pagination__summary {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
