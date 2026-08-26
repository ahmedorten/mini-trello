<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocaleStore } from '@/stores/locale';
import type { AppTab } from './tabs';

const props = defineProps<{
  tabs: AppTab[];
  modelValue: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [string] }>();

const { t } = useI18n();
const locale = useLocaleStore();

const tabRefs = ref<Record<string, HTMLElement | undefined>>({});

function setTabRef(key: string, el: Element | { $el: Element } | null): void {
  if (!el) {
    tabRefs.value[key] = undefined;

    return;
  }

  tabRefs.value[key] = ('$el' in el ? el.$el : el) as HTMLElement;
}

function labelFor(tab: AppTab): string {
  const label = t(tab.labelKey);

  return tab.count === undefined ? label : `${label} (${tab.count})`;
}

function select(key: string): void {
  emit('update:modelValue', key);
}

const activeIndex = computed(() => props.tabs.findIndex((tab) => tab.key === props.modelValue));

async function focusTab(index: number): Promise<void> {
  const tab = props.tabs[index];

  if (!tab) {
    return;
  }

  select(tab.key);
  await nextTick();
  tabRefs.value[tab.key]?.focus();
}

function onKeydown(event: KeyboardEvent): void {
  const count = props.tabs.length;

  if (count === 0) {
    return;
  }

  const forwardKey = locale.isRtl ? 'ArrowLeft' : 'ArrowRight';
  const backwardKey = locale.isRtl ? 'ArrowRight' : 'ArrowLeft';

  if (event.key === forwardKey) {
    event.preventDefault();
    void focusTab((activeIndex.value + 1) % count);
  } else if (event.key === backwardKey) {
    event.preventDefault();
    void focusTab((activeIndex.value - 1 + count) % count);
  } else if (event.key === 'Home') {
    event.preventDefault();
    void focusTab(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    void focusTab(count - 1);
  }
}
</script>

<template>
  <div class="app-tabs" role="tablist" @keydown="onKeydown">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :ref="(el) => setTabRef(tab.key, el as Element | null)"
      type="button"
      role="tab"
      class="app-tabs__tab"
      :class="{ 'app-tabs__tab--active': tab.key === modelValue }"
      :aria-selected="tab.key === modelValue"
      :tabindex="tab.key === modelValue ? 0 : -1"
      @click="select(tab.key)"
    >
      {{ labelFor(tab) }}
    </button>
  </div>
</template>

<style scoped>
.app-tabs {
  display: flex;
  gap: var(--space-2);
  border-block-end: 1px solid var(--color-border);
}

.app-tabs__tab {
  padding: var(--space-3) var(--space-4);
  border: none;
  border-block-end: 2px solid transparent;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font: inherit;
  font-weight: var(--font-weight-medium);
}

.app-tabs__tab--active {
  color: var(--color-accent);
  border-block-end-color: var(--color-accent);
}
</style>
