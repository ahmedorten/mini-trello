<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useLoginForm } from '../composables/useLoginForm';
import { AuthService } from '../services/auth.service';
import { useI18n } from '@/shared/composables/useI18n';
import { NotificationCenter } from '@/shared/services/NotificationCenter';

const router = useRouter();
const { t } = useI18n();
const loginError = ref<string | null>(null);

const {
  handleSubmit,
  errors,
  isSubmitting,
  email,
  emailProps,
  password,
  passwordProps,
} = useLoginForm();

const handleLogin = handleSubmit(async (values) => {
  loginError.value = null;
  try {
    await AuthService.login(values);
    NotificationCenter.toast(t('auth.loginSuccess'), 'success');
    router.push('/dashboard');
  } catch (error: any) {
    const errorMsg = error?.message || t('auth.loginSuccess').split(' ')[0] + ' Failed';
    loginError.value = errorMsg;
    NotificationCenter.toast(errorMsg, 'error');
  }
});
</script>

<template>
  <form @submit="handleLogin" class="space-y-6" novalidate>
    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-50 text-start select-none">
      {{ t('auth.loginTitle') }}
    </h3>

    <div v-if="loginError" class="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900/40 text-start" role="alert">
      {{ loginError }}
    </div>

    <BaseInput
      v-model="email"
      v-bind="emailProps"
      :label="t('auth.email')"
      type="email"
      :placeholder="t('auth.placeholderEmail')"
      :error="errors.email"
      :disabled="isSubmitting"
      id="login-email"
      name="email"
      required
      aria-required="true"
      :aria-invalid="!!errors.email"
    />

    <BaseInput
      v-model="password"
      v-bind="passwordProps"
      :label="t('auth.password')"
      type="password"
      :placeholder="t('auth.placeholderPassword')"
      :error="errors.password"
      :disabled="isSubmitting"
      id="login-password"
      name="password"
      required
      aria-required="true"
      :aria-invalid="!!errors.password"
    />

    <BaseButton
      type="submit"
      class="w-full"
      :loading="isSubmitting"
      :disabled="isSubmitting"
      aria-label="Sign in to your account"
    >
      {{ t('auth.loginBtn') }}
    </BaseButton>

    <div class="text-sm text-center">
      <router-link
        to="/register"
        class="text-indigo-600 hover:text-indigo-500 font-semibold focus:outline-none focus:underline"
        aria-label="Don't have an account? Sign up"
      >
        {{ t('auth.noAccount') }} {{ t('auth.registerLink') }}
      </router-link>
    </div>
  </form>
</template>
