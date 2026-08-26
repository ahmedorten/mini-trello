<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import AppButton from '@/components/AppButton.vue';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const email = ref('');
const password = ref('');

const redirectTarget = computed(() => {
  const redirect = route.query.redirect;

  // Only same-site paths. An absolute URL here would be an open-redirect: an
  // attacker sends /login?redirect=https://evil.example and harvests the
  // session the moment the user signs in.
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/';
});

async function submit(): Promise<void> {
  const ok = await auth.login(email.value, password.value);

  if (ok) {
    await router.replace(redirectTarget.value);
  }
}
</script>

<template>
  <section class="login">
    <div class="login__locale">
      <LocaleSwitcher />
    </div>

    <form class="login__card" @submit.prevent="submit">
      <h1>{{ t('auth.signIn') }}</h1>

      <div v-if="auth.error" role="alert" class="login__error">
        {{ auth.error }}
      </div>

      <label class="login__field" for="login-email">
        {{ t('auth.email') }}
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          autofocus
        >
      </label>

      <label class="login__field" for="login-password">
        {{ t('auth.password') }}
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        >
      </label>

      <AppButton type="submit" variant="primary" :disabled="auth.isLoading || !email || !password">
        {{ auth.isLoading ? t('auth.signingIn') : t('auth.signIn') }}
      </AppButton>
    </form>
  </section>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  min-block-size: calc(100vh - var(--header-height));
}

.login__locale {
  align-self: flex-end;
  inline-size: 100%;
  max-inline-size: 360px;
}

.login__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  inline-size: 100%;
  max-inline-size: 360px;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.login__field input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
  color: var(--color-text);
}

.login__error {
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}
</style>
