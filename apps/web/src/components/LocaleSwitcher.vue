<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import { useLocaleStore } from '@/stores/locale';

const { t } = useI18n();
const localeStore = useLocaleStore();

/** Each language's own name, in that language — never translated through the
 *  active catalogue, so it reads correctly no matter which locale is active. */
const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  ar: 'العربية',
};

function onChange(event: Event): void {
  localeStore.setLocale((event.target as HTMLSelectElement).value as AppLocale);
}
</script>

<template>
  <select
    class="locale-switcher"
    :aria-label="t('a11y.switchLanguage')"
    :value="localeStore.locale"
    @change="onChange"
  >
    <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
      {{ LOCALE_NAMES[code] }}
    </option>
  </select>
</template>

<style scoped>
.locale-switcher {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}
</style>
