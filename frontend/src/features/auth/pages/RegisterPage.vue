<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/shared/components/base/BaseInput.vue';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { useRegisterForm } from '../composables/useRegisterForm';
import { AuthService } from '../services/auth.service';
import { useI18n } from '@/shared/composables/useI18n';
import { NotificationCenter } from '@/shared/services/NotificationCenter';

const router = useRouter();
const { t } = useI18n();
const registerError = ref<string | null>(null);

const {
  handleSubmit,
  errors,
  isSubmitting,
  fullName,
  fullNameProps,
  email,
  emailProps,
  password,
  passwordProps,
} = useRegisterForm();

const handleRegister = handleSubmit(async (values) => {
  registerError.value = null;
  try {
    await AuthService.register(values);
    NotificationCenter.toast(t('auth.registerSuccess'), 'success');
    router.push('/dashboard');
  } catch (error: any) {
    const errorMsg = error?.message || t('auth.registerSuccess').split(' ')[0] + ' Failed';
    registerError.value = errorMsg;
    NotificationCenter.toast(errorMsg, 'error');
  }
});
</script>

<template>
  <form @submit="handleRegister" class="space-y-6" novalidate>
    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-50 text-start select-none">
      {{ t('auth.registerTitle') }}
    </h3>

    <div v-if="registerError" class="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900/40 text-start" role="alert">
      {{ registerError }}
    </div>

    <BaseInput
      v-model="fullName"
      v-bind="fullNameProps"
      :label="t('auth.name')"
      type="text"
      :placeholder="t('auth.placeholderName')"
      :error="errors.fullName"
      :disabled="isSubmitting"
      id="register-fullname"
      name="fullName"
      required
      aria-required="true"
      :aria-invalid="!!errors.fullName"
    />

    <BaseInput
      v-model="email"
      v-bind="emailProps"
      :label="t('auth.email')"
      type="email"
      :placeholder="t('auth.placeholderEmail')"
      :error="errors.email"
      :disabled="isSubmitting"
      id="register-email"
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
      id="register-password"
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
      aria-label="Create your account"
    >
      {{ t('auth.registerBtn') }}
    </BaseButton>

    <div class="text-sm text-center">
      <router-link
        to="/login"
        class="text-indigo-600 hover:text-indigo-500 font-semibold focus:outline-none focus:underline"
        aria-label="Already have an account? Sign in"
      >
        {{ t('auth.hasAccount') }} {{ t('auth.loginLink') }}
      </router-link>
    </div>
  </form>
</template>
