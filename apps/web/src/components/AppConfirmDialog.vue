<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

withDefaults(
  defineProps<{
    open: boolean;
    /** An existing i18n key — the nine confirmation strings are already
     *  translated in both catalogues (Product rule 5). */
    messageKey: string;
    messageParams?: Record<string, unknown>;
    confirmLabelKey?: string;
    busy?: boolean;
  }>(),
  { messageParams: undefined, confirmLabelKey: 'common.delete', busy: false },
);

const emit = defineEmits<{ 'update:open': [boolean]; confirm: [] }>();

const { t } = useI18n();
</script>

<template>
  <AppModal :open="open" title-key="common.confirmDialog.title" @update:open="emit('update:open', $event)">
    <p class="app-confirm__message">{{ t(messageKey, messageParams ?? {}) }}</p>

    <div class="form-actions">
      <!-- Cancel FIRST in the DOM: AppModal focuses the first focusable
           element, so an accidental Enter cancels rather than deletes
           (Product rule 6). -->
      <AppButton variant="secondary" @click="emit('update:open', false)">
        {{ t('common.cancel') }}
      </AppButton>
      <AppButton variant="danger" :loading="busy" @click="emit('confirm')">
        {{ t(confirmLabelKey) }}
      </AppButton>
    </div>
  </AppModal>
</template>

<style scoped>
.app-confirm__message {
  margin: 0 0 var(--space-4);
  line-height: var(--line-height-body);
}
</style>
