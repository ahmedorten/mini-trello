<script setup lang="ts">
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseIcon from '@/shared/components/base/BaseIcon.vue';
import EmptyState from '@/shared/components/feedback/EmptyState.vue';
import { useI18n } from '@/shared/composables/useI18n';

defineEmits<{
  (e: 'create'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <EmptyState
    icon="presentation-chart-line"
    :title="t('boards.emptyTitle')"
    :description="t('boards.emptyDesc')"
    class="min-h-[320px]"
  >
    <template #action>
      <BaseButton
        @click="$emit('create')"
        class="flex items-center gap-1.5 shadow-sm"
        aria-label="Create your first board"
      >
        <BaseIcon name="plus" size="sm" />
        <span>{{ t('boards.createBoard') }}</span>
      </BaseButton>
    </template>
  </EmptyState>
</template>
