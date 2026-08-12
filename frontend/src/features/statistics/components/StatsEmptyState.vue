<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/shared/composables/useI18n';
import BaseButton from '@/shared/components/base/BaseButton.vue';
import { PlusIcon } from '@heroicons/vue/24/outline';

const emit = defineEmits<{
  (e: 'create'): void;
}>();

const { locale } = useI18n();

const title = computed(() => {
  return locale.value === 'ar' ? 'ابدأ مسيرة إنتاجيتك مع ميني تريلو!' : 'Start your productivity journey!';
});

const subtitle = computed(() => {
  return locale.value === 'ar'
    ? 'قم بإنشاء لوحتك الأولى لتنظيم المهام، وتتبع سير العمل، والتعاون مع فريقك بفعالية.'
    : 'Create your very first project board to organize tasks, columns, checklists, and visualize progress metrics.';
});

const ctaLabel = computed(() => {
  return locale.value === 'ar' ? 'إنشاء لوحتك الأولى' : 'Create your first board';
});

const tipsTitle = computed(() => {
  return locale.value === 'ar' ? 'نصائح للبدء السريع' : 'Quick onboarding tips';
});

const tips = computed(() => [
  {
    title: locale.value === 'ar' ? 'اللوحات (Boards)' : 'Boards',
    desc: locale.value === 'ar' ? 'تمثل المشاريع أو مساحات العمل العامة.' : 'Represent major projects or workflow channels.'
  },
  {
    title: locale.value === 'ar' ? 'الأعمدة (Columns)' : 'Columns',
    desc: locale.value === 'ar' ? 'تمثل مراحل العمل مثل (قيد الانتظار، قيد التنفيذ، منجز).' : 'Represent workflow steps (To Do, In Progress, Done).'
  },
  {
    title: locale.value === 'ar' ? 'البطاقات (Cards)' : 'Cards',
    desc: locale.value === 'ar' ? 'تحتوي على تفاصيل المهام، التواريخ، قوائم التحقق، والمرفقات.' : 'Hold task names, due dates, custom checklists, and attachments.'
  }
]);
</script>

<template>
  <div class="max-w-2xl mx-auto py-12 px-6 bg-surface-raised border border-border rounded-2xl shadow-sm text-center select-none flex flex-col items-center">
    <!-- Abstract SaaS Illustration -->
    <svg class="h-28 w-28 text-indigo-500/80 dark:text-indigo-400/70 mb-6" fill="none" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="20" width="90" height="80" rx="12" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="2.5" />
      <!-- Left Column Header & Cards -->
      <rect x="25" y="32" width="22" height="6" rx="2" fill="currentColor" fill-opacity="0.3" />
      <rect x="25" y="44" width="22" height="14" rx="4" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.5" />
      <rect x="25" y="64" width="22" height="24" rx="4" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1.5" />
      <!-- Right Column Header & Cards -->
      <rect x="54" y="32" width="22" height="6" rx="2" fill="currentColor" fill-opacity="0.3" />
      <rect x="54" y="44" width="22" height="24" rx="4" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1.5" />
      <rect x="54" y="74" width="22" height="14" rx="4" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.5" />
      <!-- Checkmark Indicator -->
      <circle cx="95" cy="85" r="14" fill="currentColor" class="text-emerald-500/10 dark:text-emerald-400/20" />
      <path d="M90 85 l3.5 3.5 l6.5 -6.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500 dark:text-emerald-400" />
    </svg>

    <!-- Welcome text -->
    <h2 class="text-lg font-bold text-text-base">
      {{ title }}
    </h2>
    <p class="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
      {{ subtitle }}
    </p>

    <!-- CTA Button -->
    <BaseButton
      @click="emit('create')"
      class="mt-6 inline-flex items-center gap-1.5 shadow-sm active:scale-[0.97] transition-all"
    >
      <PlusIcon class="h-4 w-4" />
      <span>{{ ctaLabel }}</span>
    </BaseButton>

    <!-- Quick Onboarding Tips List -->
    <div class="w-full border-t border-border mt-8 pt-6 text-start max-w-md">
      <h4 class="text-xs font-bold text-text-base uppercase tracking-wider mb-3">
        {{ tipsTitle }}
      </h4>
      <ul class="space-y-3.5">
        <li v-for="(tip, idx) in tips" :key="idx" class="flex items-start gap-2.5">
          <span class="inline-flex h-4 w-4 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold items-center justify-center mt-0.5">
            {{ idx + 1 }}
          </span>
          <div class="text-[11px] leading-tight">
            <span class="font-bold text-text-base block sm:inline">{{ tip.title }}:</span>
            <span class="text-text-muted sm:ms-1">{{ tip.desc }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
