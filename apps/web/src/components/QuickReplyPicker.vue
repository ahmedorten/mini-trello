<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocaleStore } from '@/stores/locale';
import { listQuickReplies, type QuickReply } from '@/api/quickReplies';
import type { InteractionChannel } from '@/api/customers';
import AppButton from './AppButton.vue';
import AppStateBlock from './AppStateBlock.vue';

const props = withDefaults(
  defineProps<{
    channel?: InteractionChannel;
    modelValue: string;
    mode?: 'insert' | 'browse';
  }>(),
  { channel: undefined, mode: 'insert' },
);

const emit = defineEmits<{ 'update:modelValue': [string] }>();

const localeStore = useLocaleStore();
const { t } = useI18n();

const replies = ref<QuickReply[]>([]);
const isLoading = ref(false);
const isForbidden = ref(false);
const copiedId = ref<string | null>(null);

async function load(): Promise<void> {
  isLoading.value = true;
  isForbidden.value = false;

  try {
    const result = await listQuickReplies({ locale: localeStore.locale, channel: props.channel });

    // Story 17 Product rule 7: a locale can have no rows yet. Falling back to
    // `en` beats showing an empty picker in a locale that simply has no
    // catalogue populated for it yet.
    if (result.length === 0 && localeStore.locale !== 'en') {
      replies.value = await listQuickReplies({ locale: 'en', channel: props.channel });
    } else {
      replies.value = result;
    }
  } catch {
    // A caller without quick-replies:read simply sees a "no access" empty state.
    replies.value = [];
    isForbidden.value = true;
  } finally {
    isLoading.value = false;
  }
}

watch([() => props.channel, () => localeStore.locale], load);

onMounted(load);

function insert(reply: QuickReply): void {
  const current = props.modelValue;
  const next = current.trim().length > 0 ? `${current}\n${reply.body}` : reply.body;
  emit('update:modelValue', next);
}

async function copy(reply: QuickReply): Promise<void> {
  try {
    await navigator.clipboard.writeText(reply.body);
    copiedId.value = reply.id;
  } catch {
    // Clipboard access can be denied by the browser; the reply text is still
    // visible on screen for a manual copy.
  }
}
</script>

<template>
  <div class="quick-reply-picker">
    <AppStateBlock v-if="isLoading && !replies.length" variant="loading" :message="t('common.loading')" />

    <AppStateBlock v-else-if="isForbidden" variant="empty" :message="t('quickReply.noAccess')" />

    <AppStateBlock v-else-if="!replies.length" variant="empty" :message="t('quickReply.empty')" />

    <ul v-else class="quick-reply-picker__list">
      <li v-for="reply in replies" :key="reply.id" class="quick-reply-picker__item">
        <div class="quick-reply-picker__text">
          <p class="quick-reply-picker__title">{{ reply.title }}</p>
          <p class="quick-reply-picker__body">{{ reply.body }}</p>
        </div>

        <AppButton v-if="mode === 'insert'" variant="ghost" size="sm" @click="insert(reply)">
          {{ t('quickReply.insert') }}
        </AppButton>

        <AppButton v-else variant="ghost" size="sm" @click="copy(reply)">
          {{ copiedId === reply.id ? t('common.state.success') : t('quickReply.copy') }}
        </AppButton>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.quick-reply-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quick-reply-picker__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.quick-reply-picker__text {
  min-inline-size: 0;
}

.quick-reply-picker__title {
  margin: 0;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.quick-reply-picker__body {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
