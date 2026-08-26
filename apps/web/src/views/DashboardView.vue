<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section>
    <h1>{{ t('dashboard.title') }}</h1>
    <p>{{ t('dashboard.intro') }}</p>
    <p>
      <i18n-t keypath="dashboard.systemStatusLink" tag="span" scope="global">
        <template #link>
          <RouterLink to="/system-status">{{ t('nav.systemStatus') }}</RouterLink>
        </template>
      </i18n-t>
    </p>
  </section>
</template>
