<script setup lang="ts">
import BaseButton from '@/shared/components/base/BaseButton.vue';
import BaseIcon from '@/shared/components/base/BaseIcon.vue';
import PageHeader from '@/shared/components/layout/PageHeader.vue';
import { useI18n } from '@/shared/composables/useI18n';

defineEmits<{
  (e: 'create'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <PageHeader
    :title="t('boards.title')"
    :subtitle="t('boards.createBoardDesc')"
  >
    <template #actions>
      <BaseButton
        @click="$emit('create')"
        class="flex items-center gap-1.5 shadow-sm"
        aria-label="Create a new board"
      >
        <BaseIcon name="plus" size="sm" />
        <span>{{ t('boards.createBoard') }}</span>
      </BaseButton>
    </template>
  </PageHeader>
</template>
