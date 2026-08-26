<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppButton from './AppButton.vue';

const props = defineProps<{
  open: boolean;
  titleKey: string;
}>();

const emit = defineEmits<{ 'update:open': [boolean] }>();

const { t } = useI18n();

const titleId = useId();
const dialogRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(): HTMLElement[] {
  if (!dialogRef.value) {
    return [];
  }

  return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function close(): void {
  emit('update:open', false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();

    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const elements = focusableElements();

  if (elements.length === 0) {
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      focusableElements()[0]?.focus();
    } else {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
);

onBeforeUnmount(() => {
  previouslyFocused?.focus();
});

const resolvedTitle = computed(() => t(props.titleKey));
</script>

<template>
  <div v-if="open" class="app-modal__overlay" @click.self="close">
    <div
      ref="dialogRef"
      class="app-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="onKeydown"
    >
      <header class="app-modal__header">
        <h2 :id="titleId" class="app-modal__title">{{ resolvedTitle }}</h2>
        <AppButton
          variant="ghost"
          size="sm"
          icon="close"
          icon-only
          :aria-label="t('common.close')"
          @click="close"
        />
      </header>

      <div class="app-modal__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="app-modal__footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-overlay);
}

.app-modal {
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
}

.app-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-block-end: 1px solid var(--color-border);
}

.app-modal__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.app-modal__body {
  padding: var(--space-5);
}

.app-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-block-start: 1px solid var(--color-border);
}
</style>
