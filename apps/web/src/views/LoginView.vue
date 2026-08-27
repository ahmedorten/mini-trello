<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';
import { devTestUserMessages, devTestUsers, devTestUserPassword, type DevTestUser } from '@/config/devTestUsers';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t, mergeLocaleMessage } = useI18n();

// The picker's strings are merged in here, not stored in en.json/ar.json —
// createI18n loads those catalogues whole and eagerly, so a string placed
// there would ship in the production bundle even though this whole block is
// eliminated by import.meta.env.DEV (see devTestUsers.ts).
if (import.meta.env.DEV) {
  mergeLocaleMessage('en', devTestUserMessages.en);
  mergeLocaleMessage('ar', devTestUserMessages.ar);
}

const email = ref('');
const password = ref('');
const passwordInput = ref<HTMLInputElement | null>(null);

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

/**
 * Fills the form and stops. It does NOT call auth.login and does NOT submit —
 * the user still presses Sign in, and authentication still goes through the
 * existing POST /api/auth/login (Product rule 4).
 */
function useTestUser(user: DevTestUser): void {
  email.value = user.email;
  password.value = devTestUserPassword;

  // With no VITE_DEV_TEST_USER_PASSWORD the email is still the tedious half;
  // put the cursor where the remaining work is (Product rule 3).
  if (!devTestUserPassword) {
    passwordInput.value?.focus();
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

      <div v-if="auth.error" role="alert" class="form-error">
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
          ref="passwordInput"
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

    <!-- Development builds only. import.meta.env.DEV is a compile-time
         constant, so `devTestUsers` is an empty array and this whole block is
         eliminated in a production build (Product rule 1). -->
    <section v-if="devTestUsers.length" class="login__test-users" aria-labelledby="login-test-users-heading">
      <h2 id="login-test-users-heading" class="login__test-users-heading">
        <AppIcon name="info" :size="14" />
        {{ t('auth.testUsers.title') }}
      </h2>

      <p class="login__test-users-hint">{{ t('auth.testUsers.hint') }}</p>

      <ul class="login__test-users-list">
        <li v-for="user in devTestUsers" :key="user.email" class="login__test-user">
          <span class="login__test-user-identity">
            <span class="login__test-user-name">{{ user.fullName }}</span>
            <span class="login__test-user-role">{{ t(`role.${user.roleKey}`) }}</span>
            <span class="login__test-user-email" dir="ltr">{{ user.email }}</span>
          </span>
          <AppButton
            variant="secondary"
            size="sm"
            icon="user-check"
            :aria-label="t('auth.testUsers.useThisFor', { name: user.fullName })"
            @click="useTestUser(user)"
          >
            {{ t('auth.testUsers.useThis') }}
          </AppButton>
        </li>
      </ul>

      <p v-if="!devTestUserPassword" class="login__test-users-warning">
        {{ t('auth.testUsers.passwordMissing') }}
      </p>
    </section>
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

.login__test-users {
  inline-size: 100%;
  max-inline-size: 360px;
  padding: var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface-sunken);
}

.login__test-users-heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.login__test-users-hint,
.login__test-users-warning {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-body);
}

.login__test-users-warning {
  margin-block: var(--space-3) 0;
  color: var(--color-warn);
}

.login__test-users-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.login__test-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.login__test-user-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.login__test-user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.login__test-user-role,
.login__test-user-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
