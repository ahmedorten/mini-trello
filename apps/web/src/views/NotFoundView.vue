<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppStateBlock from '@/components/AppStateBlock.vue';

const { t } = useI18n();
</script>

<template>
  <section>
    <AppStateBlock variant="empty" icon="alert-circle" :message="t('error.notFound')">
      <template #actions>
        <RouterLink to="/">{{ t('common.backToDashboard') }}</RouterLink>
      </template>
    </AppStateBlock>
  </section>
</template>
