<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

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
    <form class="login__card" @submit.prevent="submit">
      <h1>Sign in</h1>

      <div v-if="auth.error" role="alert" class="login__error">
        {{ auth.error }}
      </div>

      <label class="login__field" for="login-email">
        Email
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
        Password
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        >
      </label>

      <button type="submit" :disabled="auth.isLoading || !email || !password">
        {{ auth.isLoading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 56px);
}

.login__card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.login__field input {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
  color: var(--color-text);
}

.login__error {
  padding: 0.75rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-error) 10%, white);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  font-size: 0.9rem;
}

.login__card button {
  padding: 0.6rem;
  border: none;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.login__card button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
